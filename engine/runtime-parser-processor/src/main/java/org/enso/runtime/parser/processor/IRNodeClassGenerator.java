package org.enso.runtime.parser.processor;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import javax.annotation.processing.ProcessingEnvironment;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.TypeElement;
import org.enso.runtime.parser.dsl.IRChild;
import org.enso.runtime.parser.dsl.IRCopyMethod;
import org.enso.runtime.parser.dsl.IRNode;
import org.enso.runtime.parser.processor.field.Field;
import org.enso.runtime.parser.processor.field.FieldCollector;
import org.enso.runtime.parser.processor.methodgen.BuilderMethodGenerator;
import org.enso.runtime.parser.processor.methodgen.CopyMethodGenerator;
import org.enso.runtime.parser.processor.methodgen.DuplicateMethodGenerator;
import org.enso.runtime.parser.processor.methodgen.EqualsMethodGenerator;
import org.enso.runtime.parser.processor.methodgen.HashCodeMethodGenerator;
import org.enso.runtime.parser.processor.methodgen.MapExpressionsMethodGenerator;
import org.enso.runtime.parser.processor.methodgen.SetLocationMethodGenerator;

/**
 * Generates code for interfaces annotated with {@link org.enso.runtime.parser.dsl.IRNode}.
 * Technically, the interface does not have to be annotated with {@link
 * org.enso.runtime.parser.dsl.IRNode}, it can just be enclosed by another interface with that
 * annotation.
 *
 * <p>It is expected that the interface (passed as {@link javax.lang.model.element.TypeElement} in
 * this class) extends {@link org.enso.compiler.core.IR}, either directly or via a hierarchy of
 * other super interfaces.
 *
 * <p>Every parameterless abstract method defined by the interface (or any super interface) is
 * treated as a field of the IR node. If the parameterless method is annotated with {@link
 * org.enso.runtime.parser.dsl.IRChild}, it is treated as a <emph>child</emph> and will get into the
 * generated code for, e.g., methods like {@link org.enso.compiler.core.IR#children()}.
 */
final class IRNodeClassGenerator {
  private final ProcessingEnvironment processingEnv;
  private final TypeElement interfaceType;

  /** Name of the class that is being generated */
  private final String className;

  private final GeneratedClassContext generatedClassContext;
  private final DuplicateMethodGenerator duplicateMethodGenerator;
  private final SetLocationMethodGenerator setLocationMethodGenerator;
  private final BuilderMethodGenerator builderMethodGenerator;
  private final MapExpressionsMethodGenerator mapExpressionsMethodGenerator;
  private final EqualsMethodGenerator equalsMethodGenerator;
  private final HashCodeMethodGenerator hashCodeMethodGenerator;

  /**
   * For every method annotated with {@link IRCopyMethod}, there is a generator. Can be empty. Not
   * null.
   */
  private final List<CopyMethodGenerator> copyMethodGenerators;

  private static final Set<String> defaultImportedTypes =
      Set.of(
          "java.util.UUID",
          "java.util.ArrayList",
          "java.util.function.Function",
          "java.util.Objects",
          "org.enso.compiler.core.Identifier",
          "org.enso.compiler.core.IR",
          "org.enso.compiler.core.ir.DiagnosticStorage",
          "org.enso.compiler.core.ir.DiagnosticStorage$",
          "org.enso.compiler.core.ir.Expression",
          "org.enso.compiler.core.ir.IdentifiedLocation",
          "org.enso.compiler.core.ir.MetadataStorage",
          "scala.Option");

  /**
   * @param interfaceType Type of the interface for which we are generating code. It is expected
   *     that the interface does not contain any nested interfaces or classes, just methods.
   * @param className Name of the generated class. Non qualified.
   */
  IRNodeClassGenerator(
      ProcessingEnvironment processingEnv, TypeElement interfaceType, String className) {
    assert !className.contains(".") : "Class name should be simple, not qualified";
    this.processingEnv = processingEnv;
    this.interfaceType = interfaceType;
    this.className = className;
    var userFields = getAllUserFields(interfaceType);
    var duplicateMethod = Utils.findDuplicateMethod(interfaceType, processingEnv);
    this.generatedClassContext =
        new GeneratedClassContext(className, userFields, processingEnv, interfaceType);
    this.duplicateMethodGenerator =
        new DuplicateMethodGenerator(duplicateMethod, generatedClassContext);
    this.builderMethodGenerator = new BuilderMethodGenerator(generatedClassContext);
    var mapExpressionsMethod = Utils.findMapExpressionsMethod(interfaceType, processingEnv);
    this.mapExpressionsMethodGenerator =
        new MapExpressionsMethodGenerator(mapExpressionsMethod, generatedClassContext);
    var setLocationMethod =
        Utils.findMethod(
            interfaceType,
            processingEnv,
            method -> method.getSimpleName().toString().equals("setLocation"));
    this.setLocationMethodGenerator =
        new SetLocationMethodGenerator(setLocationMethod, processingEnv);
    this.copyMethodGenerators =
        findCopyMethods().stream()
            .map(copyMethod -> new CopyMethodGenerator(copyMethod, generatedClassContext))
            .toList();
    this.equalsMethodGenerator = new EqualsMethodGenerator(generatedClassContext);
    this.hashCodeMethodGenerator = new HashCodeMethodGenerator(generatedClassContext);
    var nestedTypes =
        interfaceType.getEnclosedElements().stream()
            .filter(
                elem ->
                    elem.getKind() == ElementKind.INTERFACE || elem.getKind() == ElementKind.CLASS)
            .toList();
    if (!nestedTypes.isEmpty()) {
      throw new RuntimeException("Nested types must be handled separately: " + nestedTypes);
    }
  }

  /**
   * Finds all the methods annotated with {@link IRCopyMethod} in the interface hierarchy.
   *
   * @return empty if none. Not null.
   */
  private List<ExecutableElement> findCopyMethods() {
    var copyMethods = new ArrayList<ExecutableElement>();
    Utils.iterateSuperInterfaces(
        interfaceType,
        processingEnv,
        (TypeElement iface) -> {
          for (var enclosedElem : iface.getEnclosedElements()) {
            if (enclosedElem instanceof ExecutableElement executableElem
                && Utils.hasAnnotation(executableElem, IRCopyMethod.class)) {
              copyMethods.add(executableElem);
            }
          }
          return null;
        });
    return copyMethods;
  }

  /** Returns simple name of the generated class. */
  String getClassName() {
    return className;
  }

  /**
   * Returns the simple name of the interface for which an implementing class is being generated.
   */
  String getInterfaceName() {
    return interfaceType.getSimpleName().toString();
  }

  /** Returns set of import statements that should be included in the generated class. */
  Set<String> imports() {
    var importsForFields =
        generatedClassContext.getUserFields().stream()
            .flatMap(field -> field.getImportedTypes().stream())
            .collect(Collectors.toUnmodifiableSet());
    var allImports = new HashSet<String>();
    allImports.addAll(defaultImportedTypes);
    allImports.addAll(importsForFields);
    return allImports.stream()
        .map(importedType -> "import " + importedType + ";")
        .collect(Collectors.toUnmodifiableSet());
  }

  /** Generates the body of the class - fields, field setters, method overrides, builder, etc. */
  String classBody() {
    return """
        $fields

        $constructor

        public static Builder builder() {
          return new Builder();
        }

        $overrideUserDefinedMethods

        $overrideIRMethods

        $mapExpressionsMethod

        $copyMethods

        $equalsMethod

        $hashCodeMethod

        $builder
        """
        .replace("$fields", fieldsCode())
        .replace("$constructor", constructor())
        .replace("$overrideUserDefinedMethods", overrideUserDefinedMethods())
        .replace("$overrideIRMethods", overrideIRMethods())
        .replace("$mapExpressionsMethod", mapExpressions())
        .replace("$copyMethods", copyMethods())
        .replace("$equalsMethod", equalsMethodGenerator.generateMethodCode())
        .replace("$hashCodeMethod", hashCodeMethodGenerator.generateMethodCode())
        .replace("$builder", builderMethodGenerator.generateBuilder());
  }

  /**
   * Collects all abstract methods (with no parameters) from this interface and all the interfaces
   * that are extended by this interface. Every abstract method corresponds to a single field in the
   * newly generated record. Abstract methods annotated with {@link IRChild} are considered IR
   * children.
   *
   * @param irNodeInterface Type element of the interface annotated with {@link IRNode}.
   * @return List of fields
   */
  private List<Field> getAllUserFields(TypeElement irNodeInterface) {
    var fieldCollector = new FieldCollector(processingEnv, irNodeInterface);
    return fieldCollector.collectFields();
  }

  /**
   * Returns string representation of the class fields. Meant to be at the beginning of the class
   * body.
   */
  private String fieldsCode() {
    var userDefinedFields =
        generatedClassContext.getUserFields().stream()
            .map(field -> "private final " + field.getSimpleTypeName() + " " + field.getName())
            .collect(Collectors.joining(";" + System.lineSeparator()));
    var code =
        """
        $userDefinedFields;
        // Not final on purpose
        private DiagnosticStorage diagnostics;
        private MetadataStorage passData;
        private IdentifiedLocation location;
        private UUID id;
        """
            .replace("$userDefinedFields", userDefinedFields);
    return indent(code, 2);
  }

  /**
   * Returns string representation of the package-private constructor of the generated class. Note
   * that the constructor is meant to be invoked only by the internal Builder class.
   */
  private String constructor() {
    var sb = new StringBuilder();
    sb.append("private ").append(className).append("(");
    var inParens =
        generatedClassContext.getConstructorParameters().stream()
            .map(
                consParam ->
                    "$consType $consName"
                        .replace("$consType", consParam.type())
                        .replace("$consName", consParam.name()))
            .collect(Collectors.joining(", "));
    sb.append(inParens).append(") {").append(System.lineSeparator());
    var ctorBody =
        generatedClassContext.getAllFields().stream()
            .map(field -> "  this.$fieldName = $fieldName;".replace("$fieldName", field.name()))
            .collect(Collectors.joining(System.lineSeparator()));
    sb.append(indent(ctorBody, 2));
    sb.append(System.lineSeparator());
    sb.append("}").append(System.lineSeparator());
    return indent(sb.toString(), 2);
  }

  private String childrenMethodBody() {
    var sb = new StringBuilder();
    var nl = System.lineSeparator();
    sb.append("var list = new ArrayList<IR>();").append(nl);
    generatedClassContext.getUserFields().stream()
        .filter(Field::isChild)
        .forEach(
            childField -> {
              String addToListCode;
              if (!childField.isList()) {
                addToListCode = "list.add(" + childField.getName() + ");";
              } else {
                addToListCode =
                    """
                    $childName.foreach(list::add);
                    """
                        .replace("$childName", childField.getName());
              }
              var childName = childField.getName();
              if (childField.isNullable()) {
                sb.append(
                    """
                if ($childName != null) {
                  $addToListCode
                }
                """
                        .replace("$childName", childName)
                        .replace("$addToListCode", addToListCode));
              } else {
                sb.append(addToListCode);
              }
            });
    sb.append("return scala.jdk.javaapi.CollectionConverters.asScala(list).toList();").append(nl);
    return indent(sb.toString(), 2);
  }

  /**
   * Returns a String representing all the overriden methods from {@link org.enso.compiler.core.IR}.
   * Meant to be inside the generated record definition.
   */
  private String overrideIRMethods() {
    var code =
        """

        @Override
        public MetadataStorage passData() {
          if (passData == null) {
            passData = new MetadataStorage();
          }
          return passData;
        }

        @Override
        public Option<IdentifiedLocation> location() {
          if (location == null) {
            return scala.Option.empty();
          } else {
            return scala.Option.apply(location);
          }
        }

        $setLocationMethod

        @Override
        public IdentifiedLocation identifiedLocation() {
          return this.location;
        }

        @Override
        public scala.collection.immutable.List<IR> children() {
        $childrenMethodBody
        }

        @Override
        public @Identifier UUID getId() {
          if (id == null) {
            id = UUID.randomUUID();
          }
          return id;
        }

        @Override
        public DiagnosticStorage diagnostics() {
          return diagnostics;
        }

        @Override
        public DiagnosticStorage getDiagnostics() {
          if (diagnostics == null) {
            diagnostics = DiagnosticStorage$.MODULE$.empty();
          }
          return diagnostics;
        }

        $duplicateMethod

        @Override
        public String showCode(int indent) {
          throw new UnsupportedOperationException("unimplemented");
        }
        """
            .replace("$childrenMethodBody", childrenMethodBody())
            .replace("$setLocationMethod", setLocationMethodGenerator.generateMethodCode())
            .replace("$duplicateMethod", duplicateMethodGenerator.generateDuplicateMethodCode());
    return indent(code, 2);
  }

  /**
   * Returns string representation of all parameterless abstract methods from the interface
   * annotated with {@link IRNode}.
   *
   * @return Code of the overriden methods
   */
  private String overrideUserDefinedMethods() {
    var code =
        generatedClassContext.getUserFields().stream()
            .map(
                field ->
                    """
            @Override
            public $returnType $fieldName() {
              return $fieldName;
            }
            """
                        .replace("$returnType", field.getSimpleTypeName())
                        .replace("$fieldName", field.getName()))
            .collect(Collectors.joining(System.lineSeparator()));
    return indent(code, 2);
  }

  /**
   * Generates the code for all the copy methods. Returns an empty string if there are no methods
   * annotated with {@link IRCopyMethod}.
   *
   * @return Code of the copy method or an empty string if the method is not present.
   */
  private String copyMethods() {
    return copyMethodGenerators.stream()
        .map(CopyMethodGenerator::generateCopyMethod)
        .collect(Collectors.joining(System.lineSeparator()));
  }

  private String mapExpressions() {
    return Utils.indent(mapExpressionsMethodGenerator.generateMapExpressionsMethodCode(), 2);
  }

  private static String indent(String code, int indentation) {
    return code.lines()
        .map(line -> " ".repeat(indentation) + line)
        .collect(Collectors.joining(System.lineSeparator()));
  }
}
