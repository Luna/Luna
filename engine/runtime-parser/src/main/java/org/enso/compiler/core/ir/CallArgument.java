package org.enso.compiler.core.ir;

import java.util.function.Function;
import org.enso.compiler.core.IR;
import org.enso.runtime.parser.dsl.GenerateFields;
import org.enso.runtime.parser.dsl.GenerateIR;
import org.enso.runtime.parser.dsl.IRChild;
import org.enso.runtime.parser.dsl.IRField;
import scala.Option;

/** Call-site arguments in Enso. */
public interface CallArgument extends IR {
  /** The name of the argument, if present. */
  Option<Name> name();

  /** The expression of the argument, if present. */
  Expression value();

  /** Flag indicating that the argument was generated by compiler. */
  boolean isSynthetic();

  @Override
  CallArgument mapExpressions(Function<Expression, Expression> fn);

  @Override
  CallArgument duplicate(
      boolean keepLocations,
      boolean keepMetadata,
      boolean keepDiagnostics,
      boolean keepIdentifiers);

  /**
   * A representation of an argument at a function call site.
   *
   * <p>A {@link CallArgument} where the {@link CallArgument#value()} is an {@link Name.Blank} is a
   * representation of a lambda shorthand argument.
   */
  @GenerateIR(interfaces = {CallArgument.class})
  final class Specified extends SpecifiedGen {

    /**
     * @param name the name of the argument being called, if present
     * @param value the expression being passed as the argument's value
     * @param isSynthetic the flag indicating that the argument was generated by compiler
     */
    @GenerateFields
    public Specified(
        @IRChild Option<Name> name,
        @IRChild Expression value,
        @IRField boolean isSynthetic,
        IdentifiedLocation identifiedLocation,
        MetadataStorage passData) {
      super(null, passData, identifiedLocation, null, name, value, isSynthetic);
    }

    public Specified(
        Option<Name> name,
        Expression value,
        boolean isSynthetic,
        IdentifiedLocation identifiedLocation) {
      this(name, value, isSynthetic, identifiedLocation, null);
    }

    public Specified copy(Expression value) {
      if (value != this.value()) {
        var duplicated =
            new Specified(name(), value, isSynthetic(), identifiedLocation(), passData());
        duplicated.id = id;
        duplicated.diagnostics = diagnostics;
        return duplicated;
      } else {
        return this;
      }
    }
  }
}
