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
 * <h2>Fields</h2>
 *
 * The generated class will contain 4 <b>meta</b> fields that are required to be present inside
 * every IR element:
 *
 * <ul>
 *   <li>{@code private DiagnosticStorage diagnostics}
 *   <li>{@code private MetadataStorage passData}
 *   <li>{@code private IdentifiedLocation location}
 *   <li>{@code private UUID id}
 * </ul>
 *
 * Apart from these <b>meta</b> fields, the generated class will also contain <b>user-defined</b>
 * fields. User-defined fields are inferred from all the parameters of the constructor. The
 * parameter of the constructor can be one of the following:
 *
 * <ul>
 *   <li>Any reference, or primitive type without annotation
 *   <li>A subtype of {@code org.enso.compiler.ir.IR} annotated with {@link IRChild}
 *   <li>One of the <emph>meta</emph> types mentioned above
 * </ul>
 *
 * A user-defined field generated out of constructor parameter annotated with {@link IRChild} is a
 * child element of this IR element. That means that it will be included in generated implementation
 * of IR methods that iterate over the IR tree. For example {@code mapExpressions} or {@code
 * children}.
 *
 * <p>A user-defined field generated out of constructor parameter that is not annotated with {@link
 * IRChild} will be just a field for which there will be generated a getter.
 *
 * <p>For a constructor parameter of a meta type, there will be no user-defined field generated, as
 * the meta fields are always generated.
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
  String[] interfaces() default {};
}
