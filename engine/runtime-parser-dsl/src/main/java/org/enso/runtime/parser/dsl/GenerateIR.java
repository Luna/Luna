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
   * Name of the interfaces that the generated superclass must implement. All the interfaces must be
   * subtypes of the {@code org.enso.compiler.ir.IR} interface. All the abstract parameterless
   * methods from all the interfaces will be implemented by the generated class. Must not be empty.
   *
   * @return
   */
  String interfaces() default "org.enso.compiler.core.IR";
}
