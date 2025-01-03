package org.enso.runtime.parser.processor.field;

import java.util.List;
import javax.annotation.processing.ProcessingEnvironment;
import javax.lang.model.type.TypeMirror;
import org.enso.runtime.parser.processor.utils.Utils;

final class ReferenceField implements Field {
  private final ProcessingEnvironment procEnv;
  private final TypeMirror type;
  private final String name;
  private final boolean nullable;
  private final boolean isChild;

  ReferenceField(
      ProcessingEnvironment procEnv,
      TypeMirror type,
      String name,
      boolean nullable,
      boolean isChild) {
    this.procEnv = procEnv;
    this.type = type;
    this.name = name;
    this.nullable = nullable;
    this.isChild = isChild;
  }

  @Override
  public String getName() {
    return name;
  }

  @Override
  public TypeMirror getType() {
    return type;
  }

  @Override
  public String getSimpleTypeName() {
    return type.toString();
  }

  @Override
  public List<String> getImportedTypes() {
    var typeElem = Utils.typeMirrorToElement(type);
    if (typeElem != null) {
      return List.of(typeElem.getQualifiedName().toString());
    } else {
      return List.of();
    }
  }

  @Override
  public boolean isChild() {
    return isChild;
  }

  @Override
  public boolean isPrimitive() {
    return false;
  }

  @Override
  public boolean isNullable() {
    return nullable;
  }

  @Override
  public boolean isExpression() {
    return Utils.isSubtypeOfExpression(type, procEnv);
  }
}
