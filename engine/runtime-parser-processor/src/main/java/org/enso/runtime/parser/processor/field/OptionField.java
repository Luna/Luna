package org.enso.runtime.parser.processor.field;

import java.util.List;
import javax.lang.model.element.TypeElement;
import javax.lang.model.type.TypeMirror;

/** Field representing {@code scala.Option} */
public class OptionField implements Field {
  private final String name;
  private final TypeElement typeArgElement;
  private final TypeMirror type;

  public OptionField(String name, TypeMirror type, TypeElement typeArgElement) {
    this.name = name;
    this.type = type;
    this.typeArgElement = typeArgElement;
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
    var typeArg = typeArgElement.getSimpleName().toString();
    return "Option<" + typeArg + ">";
  }

  @Override
  public TypeElement getTypeParameter() {
    return typeArgElement;
  }

  @Override
  public List<String> getImportedTypes() {
    var typePar = typeArgElement.getQualifiedName().toString();
    return List.of("scala.Option", typePar);
  }

  @Override
  public boolean isOption() {
    return true;
  }

  @Override
  public boolean isChild() {
    return true;
  }

  @Override
  public boolean isNullable() {
    return false;
  }

  @Override
  public boolean isPrimitive() {
    return false;
  }

  @Override
  public boolean isExpression() {
    return false;
  }
}
