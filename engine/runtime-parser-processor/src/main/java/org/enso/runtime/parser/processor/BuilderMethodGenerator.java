package org.enso.runtime.parser.processor;

import java.util.stream.Collectors;
import org.enso.runtime.parser.processor.GeneratedClassContext.ClassField;

class BuilderMethodGenerator {
  private final GeneratedClassContext generatedClassContext;

  BuilderMethodGenerator(GeneratedClassContext generatedClassContext) {
    this.generatedClassContext = generatedClassContext;
  }

  String generateBuilder() {
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

    var fieldList =
        generatedClassContext.getAllFields().stream()
            .map(ClassField::name)
            .collect(Collectors.joining(", "));

    var code =
        """
        public static final class Builder {
          $fieldDeclarations

          Builder() {}

          $copyConstructor

          $fieldSetters

          public $className build() {
            validate();
            return new $className($fieldList);
          }

          private void validate() {
            $validationCode
          }
        }
        """
            .replace("$fieldDeclarations", fieldDeclarations)
            .replace("$copyConstructor", copyConstructor())
            .replace("$fieldSetters", fieldSetters)
            .replace("$className", generatedClassContext.getClassName())
            .replace("$fieldList", fieldList)
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
}
