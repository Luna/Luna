package org.enso.runtime.parser.dsl;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Abstract methods annotated with this annotation will return the <emph>child</emph> of the current
 * IR element (the current IR element is the interface annotated with {@link IRNode} that encloses
 * this method). Children of IR elements form a tree. A child will be part of the methods traversing
 * the tree, like {@code mapExpression} and {@code children}. The method must have no parameters and
 * return a subtype of {@code org.enso.compiler.ir.IR}.
 */
@Retention(RetentionPolicy.SOURCE)
@Target(ElementType.PARAMETER)
public @interface IRChild {
  /** If true, the child will always be non-null. Otherwise, it can be null. */
  boolean required() default true;
}
