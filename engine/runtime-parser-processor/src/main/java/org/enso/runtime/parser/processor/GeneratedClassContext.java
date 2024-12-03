package org.enso.runtime.parser.processor;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import javax.annotation.processing.ProcessingEnvironment;
import javax.lang.model.element.TypeElement;
import org.enso.runtime.parser.processor.field.Field;

/**
 * A context created for the generated class. Everything that is needed for the code generation of a
 * single class is contained in this class.
 */
final class GeneratedClassContext {
  private final String className;
  private final List<Field> userFields;
  private final List<Parameter> constructorParameters;
  private final ProcessingEnvironment processingEnvironment;
  private final TypeElement irNodeInterface;

  private static final ClassField diagnosticsMetaField =
      new ClassField("private", "DiagnosticStorage", "diagnostics");
  private static final ClassField passDataMetaField =
      new ClassField("private", "MetadataStorage", "passData");
  private static final ClassField locationMetaField =
      new ClassField("private", "IdentifiedLocation", "location");
  private static final ClassField idMetaField = new ClassField("private", "UUID", "id");

  /** Meta fields are always present in the generated class. */
  private static final List<ClassField> metaFields =
      List.of(diagnosticsMetaField, passDataMetaField, locationMetaField, idMetaField);

  /**
   * @param className Simple name of the generated class
   * @param userFields List of user defined fields. These fields are collected from parameterless
   *     abstract methods in the interface.
   * @param irNodeInterface Type element of the interface annotated with {@link
   *     org.enso.runtime.parser.dsl.IRNode} - for this interface the class is generated.
   */
  GeneratedClassContext(
      String className,
      List<Field> userFields,
      ProcessingEnvironment processingEnvironment,
      TypeElement irNodeInterface) {
    this.className = Objects.requireNonNull(className);
    this.userFields = Objects.requireNonNull(userFields);
    this.processingEnvironment = Objects.requireNonNull(processingEnvironment);
    this.irNodeInterface = irNodeInterface;
    ensureSimpleName(className);
    this.constructorParameters =
        getAllFields().stream()
            .map(classField -> new Parameter(classField.type(), classField.name()))
            .toList();
  }

  private static void ensureSimpleName(String name) {
    if (name.contains(".")) {
      throw new IllegalArgumentException("Class name must be simple, not qualified");
    }
  }

  ClassField getLocationMetaField() {
    return locationMetaField;
  }

  ClassField getPassDataMetaField() {
    return passDataMetaField;
  }

  ClassField getDiagnosticsMetaField() {
    return diagnosticsMetaField;
  }

  ClassField getIdMetaField() {
    return idMetaField;
  }

  List<Parameter> getConstructorParameters() {
    return constructorParameters;
  }

  List<Field> getUserFields() {
    return userFields;
  }

  /** Returns simple name of the class that is being generated. */
  String getClassName() {
    return className;
  }

  List<ClassField> getMetaFields() {
    return metaFields;
  }

  List<ClassField> getAllFields() {
    var allFields = new ArrayList<ClassField>(metaFields);
    for (var userField : userFields) {
      allFields.add(
          new ClassField("private final", userField.getSimpleTypeName(), userField.getName()));
    }
    return allFields;
  }

  ProcessingEnvironment getProcessingEnvironment() {
    return processingEnvironment;
  }

  TypeElement getIrNodeInterface() {
    return irNodeInterface;
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
   * @param modifiers
   */
  record ClassField(String modifiers, String type, String name) {
    @Override
    public String toString() {
      return modifiers + " " + type + " " + name;
    }
  }
}
