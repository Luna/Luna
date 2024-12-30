package org.enso.runtime.parser.dsl;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * A class annotated with this annotation will be processed by the IR processor. The processor will
 * generate a super class that is meant to be extended by this class. The generated class will have
 * the same package as this class, and its name will have the "Gen" suffix. Majority of the methods
 * in the generated class will be either private or package-private, so that they are not accessible
 * from the outside.
 *
 * <p>The class can be enclosed (nested inside) an interface.
 *
 * <p>The class must contain a single constructor annotated with {@link GenerateFields}.
 */
@Retention(RetentionPolicy.SOURCE)
@Target(ElementType.TYPE)
public @interface GenerateIR {

  /**
   * Interfaces that the generated superclass will implement. The list of the interfaces will simply
   * be put inside the {@code implements} clause of the generated class. All the generated classes
   * implements {@code org.enso.compiler.core.IR} by default.
   */
  Class[] interfaces() default {};
}
