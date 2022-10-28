package org.enso.interpreter.dsl;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** An annotation denoting a node that should be wrapped for standard library export. */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.SOURCE)
public @interface BuiltinMethod {
  /** @return the language-level type of {@code this} argument. */
  String type();

  /** @return the language-level name of this method. */
  String name();

  /** @return a short description of this method. */
  String description() default "";

  /** @return a list of aliases (names) of this method */
  String aliases() default "";

  /** @return an owner of the method */
  Owner owner() default Owner.TYPE;
}
