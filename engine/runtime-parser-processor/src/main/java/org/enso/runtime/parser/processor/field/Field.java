package org.enso.runtime.parser.processor.field;

import java.util.List;
import java.util.function.Function;
import javax.lang.model.element.TypeElement;
import org.enso.runtime.parser.dsl.IRChild;

/** Represents a field in the generated super class. */
public interface Field {

  /** Name (identifier) of the field. */
  String getName();

  /** Returns type of this field. Null if this is a primitive field. */
  TypeElement getType();

  /**
   * Does not return null. If the type is generic, the type parameter is included in the name.
   * Returns non-qualified name.
   */
  String getSimpleTypeName();

  /**
   * Returns list of (fully-qualified) types that are necessary to import in order to use simple
   * type names.
   */
  default List<String> getImportedTypes() {
    return List.of();
  }

  /** Returns true if this field is a scala immutable list. */
  default boolean isList() {
    return false;
  }

  /**
   * Returns true if this field is annotated with {@link org.enso.runtime.parser.dsl.IRChild}.
   *
   * @return
   */
  boolean isChild();

  /**
   * Returns true if this field is child with {@link IRChild#required()} set to false.
   *
   * @return
   */
  boolean isNullable();

  /** Returns true if the type of this field is Java primitive. */
  boolean isPrimitive();

  /**
   * Returns true if this field extends {@link org.enso.compiler.core.ir.Expression} ({@link
   * org.enso.compiler.core.ir.JExpression}).
   *
   * <p>This is useful, e.g., for the {@link org.enso.compiler.core.IR#mapExpressions(Function)}
   * method.
   *
   * @return true if this field extends {@link org.enso.compiler.core.ir.Expression}
   */
  boolean isExpression();

  /** Returns the type parameter, if this field is a generic type. Otherwise null. */
  default String getTypeParameter() {
    return null;
  }
}
