package org.enso.runtime.parser.processor.methodgen;

import java.util.stream.Collectors;
import org.enso.runtime.parser.processor.GeneratedClassContext;
import org.enso.runtime.parser.processor.GeneratedClassContext.ClassField;
import org.enso.runtime.parser.processor.utils.Utils;

/**
 * Code generator for builder. Builder is a nested static class inside the generated class. Builder
 * has a validation code that is invoked in {@code build()} method that ensures that all the
 * required fields are set. Builder has a copy constructor - a constructor that takes the generated
 * class object and prefills all the fields with the values from the object. This copy constructor
 * is called from either the {@code duplicate} method or from copy methods.
 */
public class BuilderMethodGenerator {
  private final GeneratedClassContext generatedClassContext;

  public BuilderMethodGenerator(GeneratedClassContext generatedClassContext) {
    this.generatedClassContext = generatedClassContext;
  }

  public String generateBuilder() {
    var fieldDeclarations =
        generatedClassContext.getAllFields().stream()
            .map(
                metaField ->
                    """
                private $type $name;
                """
                        .replace("$type", metaField.type())
                        .replace("$name", metaField.name()))
            .collect(Collectors.joining(System.lineSeparator()));

    var fieldSetters =
        generatedClassContext.getAllFields().stream()
            .map(
                field ->
                    """
        public Builder $fieldName($fieldType $fieldName) {
          this.$fieldName = $fieldName;
          return this;
        }
        """
                        .replace("$fieldName", field.name())
                        .replace("$fieldType", field.type()))
            .collect(Collectors.joining(System.lineSeparator()));

    // Validation code for all non-nullable user fields
    var validationCode =
        generatedClassContext.getUserFields().stream()
            .filter(field -> !field.isNullable() && !field.isPrimitive())
            .map(
                field ->
                    """
            if (this.$fieldName == null) {
              throw new IllegalArgumentException("$fieldName is required");
            }
            """
                        .replace("$fieldName", field.getName()))
            .collect(Collectors.joining(System.lineSeparator()));

    var code =
        """
        public static final class Builder {
          $fieldDeclarations

          Builder() {}

          $copyConstructor

          $fieldSetters

          $buildMethod

          private void validate() {
            $validationCode
          }
        }
        """
            .replace("$fieldDeclarations", fieldDeclarations)
            .replace("$copyConstructor", copyConstructor())
            .replace("$fieldSetters", fieldSetters)
            .replace("$buildMethod", buildMethod())
            .replace("$validationCode", Utils.indent(validationCode, 2));
    return Utils.indent(code, 2);
  }

  private String copyConstructor() {
    var sb = new StringBuilder();
    sb.append("/** Copy constructor */").append(System.lineSeparator());
    sb.append("Builder(")
        .append(generatedClassContext.getClassName())
        .append(" from) {")
        .append(System.lineSeparator());
    for (var classField : generatedClassContext.getAllFields()) {
      sb.append("  this.")
          .append(classField.name())
          .append(" = from.")
          .append(classField.name())
          .append(";")
          .append(System.lineSeparator());
    }
    sb.append("}").append(System.lineSeparator());
    return sb.toString();
  }

  private String buildMethod() {
    var sb = new StringBuilder();
    var processedClassName =
        generatedClassContext.getProcessedClass().getClazz().getSimpleName().toString();
    var ctorParams = generatedClassContext.getSubclassConstructorParameters();
    var ctorParamsStr = ctorParams.stream().map(ClassField::name).collect(Collectors.joining(", "));
    var fieldsNotInCtor = Utils.minus(generatedClassContext.getAllFields(), ctorParams);
    sb.append("  public ")
        .append(processedClassName)
        .append(" build() {")
        .append(System.lineSeparator());
    sb.append("    ").append("validate();").append(System.lineSeparator());
    sb.append("    ")
        .append(processedClassName)
        .append(" result = new ")
        .append(processedClassName)
        .append("(")
        .append(ctorParamsStr)
        .append(");")
        .append(System.lineSeparator());
    for (var fieldNotInCtor : fieldsNotInCtor) {
      sb.append("    ")
          .append("result.")
          .append(fieldNotInCtor.name())
          .append(" = ")
          .append(fieldNotInCtor.name())
          .append(";")
          .append(System.lineSeparator());
    }
    sb.append("    ").append("return result;").append(System.lineSeparator());
    sb.append("  }").append(System.lineSeparator());
    return sb.toString();
  }
}
