package org.enso.runtime.parser.processor;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;
import javax.annotation.processing.ProcessingEnvironment;
import javax.lang.model.element.VariableElement;
import javax.lang.model.type.DeclaredType;
import javax.lang.model.type.PrimitiveType;
import javax.lang.model.util.SimpleTypeVisitor14;
import org.enso.runtime.parser.processor.field.Field;
import org.enso.runtime.parser.processor.utils.Utils;

/**
 * A context created for the generated class. Everything that is needed for the code generation of a
 * single class is contained in this class.
 */
public final class GeneratedClassContext {
  private final String className;
  private final List<Field> userFields;
  private final List<ClassField> allFields;
  private final List<Parameter> constructorParameters;
  private final ProcessingEnvironment processingEnvironment;
  private final ProcessedClass processedClass;

  private static final ClassField diagnosticsMetaField =
      new ClassField("protected", "DiagnosticStorage", "diagnostics");
  private static final ClassField passDataMetaField =
      new ClassField("protected", "MetadataStorage", "passData");
  private static final ClassField locationMetaField =
      new ClassField("protected", "IdentifiedLocation", "location");
  private static final ClassField idMetaField = new ClassField("protected", "UUID", "id");

  /** Meta fields are always present in the generated class. */
  private static final List<ClassField> metaFields =
      List.of(diagnosticsMetaField, passDataMetaField, locationMetaField, idMetaField);

  /**
   * @param className Simple name of the generated class
   * @param userFields List of user defined fields. These fields are collected from parameterless
   *     abstract methods in the interface.
   */
  GeneratedClassContext(
      String className,
      List<Field> userFields,
      ProcessingEnvironment processingEnvironment,
      ProcessedClass processedClass) {
    this.className = Objects.requireNonNull(className);
    this.userFields = Objects.requireNonNull(userFields);
    this.processingEnvironment = Objects.requireNonNull(processingEnvironment);
    this.processedClass = processedClass;
    ensureSimpleName(className);
    this.allFields = new ArrayList<>(metaFields);
    for (var userField : userFields) {
      allFields.add(
          new ClassField("private final", userField.getSimpleTypeName(), userField.getName()));
    }
    this.constructorParameters =
        allFields.stream()
            .map(classField -> new Parameter(classField.type(), classField.name()))
            .toList();
  }

  private static void ensureSimpleName(String name) {
    if (name.contains(".")) {
      throw new IRProcessingException("Class name must be simple, not qualified", null);
    }
  }

  public ClassField getLocationMetaField() {
    return locationMetaField;
  }

  public ClassField getPassDataMetaField() {
    return passDataMetaField;
  }

  public ClassField getDiagnosticsMetaField() {
    return diagnosticsMetaField;
  }

  public ClassField getIdMetaField() {
    return idMetaField;
  }

  /**
   * Returns all constructor parameters for the default constructor of the generated class.
   * Including meta parameters.
   *
   * @return
   */
  public List<Parameter> getSuperclassConstructorParameters() {
    return constructorParameters;
  }

  public List<Field> getUserFields() {
    return userFields;
  }

  /** Returns simple name of the class that is being generated. */
  public String getClassName() {
    return className;
  }

  public ProcessedClass getProcessedClass() {
    return processedClass;
  }

  List<ClassField> getMetaFields() {
    return metaFields;
  }

  /** Returns list of all fields in the generated class - meta field and user-defined fields. */
  public List<ClassField> getAllFields() {
    return allFields;
  }

  public ProcessingEnvironment getProcessingEnvironment() {
    return processingEnvironment;
  }

  /**
   * Returns list of parameters for the constructor of the subclass annotated with {@link
   * org.enso.runtime.parser.dsl.GenerateFields}. The list is gathered from all the fields present
   * in the generated super class.
   *
   * @see #getAllFields()
   * @return List of parameters for the constructor of the subclass. A subset of all the fields in
   *     the generated super class.
   */
  public List<ClassField> getSubclassConstructorParameters() {
    var ctor = processedClass.getCtor();
    var ctorParams = new ArrayList<ClassField>();
    for (var param : ctor.getParameters()) {
      var paramSimpleType = simpleTypeName(param);
      var paramName = param.getSimpleName().toString();
      Supplier<Void> printErrAndFail =
          () -> {
            var errMsg =
                String.format(
                    "No matching field found for parameter %s of type %s. All fields: %s",
                    paramName, paramSimpleType, allFields);
            throw new IRProcessingException(errMsg, param);
          };
      var fieldsWithSameType =
          allFields.stream()
              .filter(field -> paramSimpleType.equals(field.simpleTypeName()))
              .toList();
      if (fieldsWithSameType.isEmpty()) {
        printErrAndFail.get();
      } else if (fieldsWithSameType.size() == 1) {
        ctorParams.add(fieldsWithSameType.get(0));
      } else {
        // There are multiple fields with the same type - try to match on the name
        var fieldsWithSameName =
            fieldsWithSameType.stream().filter(field -> paramName.equals(field.name)).toList();
        Utils.hardAssert(
            fieldsWithSameName.size() < 2,
            "Cannot have more than one field with the same name and type");
        if (fieldsWithSameName.isEmpty()) {
          printErrAndFail.get();
        }
        Utils.hardAssert(fieldsWithSameName.size() == 1);
        ctorParams.add(fieldsWithSameName.get(0));
      }
    }
    return ctorParams;
  }

  private String simpleTypeName(VariableElement param) {
    var paramType = param.asType();
    var typeVisitor =
        new SimpleTypeVisitor14<String, Void>() {
          @Override
          public String visitDeclared(DeclaredType t, Void unused) {
            return t.asElement().getSimpleName().toString();
          }

          @Override
          public String visitPrimitive(PrimitiveType t, Void unused) {
            return t.toString();
          }
        };
    var typeName = paramType.accept(typeVisitor, null);
    ;
    return typeName;
  }

  /**
   * Method parameter
   *
   * @param type
   * @param name
   */
  record Parameter(String type, String name) {
    @Override
    public String toString() {
      return type + " " + name;
    }
  }

  /**
   * Declared field in the class
   *
   * @param modifiers e.g. "private final"
   * @param type Type name. Includes generics. Can be, e.g., {@code Option<String>}.
   */
  public record ClassField(String modifiers, String type, String name) {
    @Override
    public String toString() {
      return modifiers + " " + type + " " + name;
    }

    /** Returns simple non-qualified type name. Generic types are returned as raw types. */
    public String simpleTypeName() {
      var typeParts = type.split("<");
      return typeParts[0];
    }
  }
}
