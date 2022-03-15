package org.enso.interpreter.node.expression.builtin.error;

import com.oracle.truffle.api.dsl.Fallback;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.nodes.Node;
import org.enso.interpreter.dsl.BuiltinMethod;
import org.enso.interpreter.runtime.Context;
import org.enso.interpreter.runtime.builtin.Builtins;
import org.enso.interpreter.runtime.callable.atom.Atom;
import org.enso.interpreter.runtime.error.PanicException;
import org.enso.interpreter.runtime.state.Stateful;

@BuiltinMethod(
    type = "Panic",
    name = "throw",
    description = "Throws a new Panic with given payload.")
public abstract class ThrowPanicNode extends Node {
  static ThrowPanicNode build() {
    return ThrowPanicNodeGen.create();
  }

  abstract Stateful execute(Object _this, Object payload);

  @Specialization
  Stateful doAtom(Object _this, Atom payload) {
    Builtins builtins = Context.get(this).getBuiltins();
    if (payload.getConstructor() == builtins.caughtPanic()) {
      // Note [Original Exception Type]
      Object originalException = payload.getFields()[1];
      if (originalException instanceof RuntimeException) {
        throw (RuntimeException) originalException;
      } else {
        throw new PanicException(
            builtins
                .error()
                .makeTypeError(
                    "RuntimeException", originalException, "internal_original_exception"),
            this);
      }
    } else {
      throw new PanicException(payload, this);
    }
  }

  @Fallback
  Stateful doFallback(Object _this, Object payload) {
    throw new PanicException(payload, this);
  }
}

/* Note [Original Exception Type]
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * We can assume that the exception stored in a `Caught_Panic` atom is a
 * subclass of a `RuntimeException`, because the only place which constructs
 * `Caught_Panic` puts a `PanicException` there or an
 * `AbstractTruffleException`, both of which are subtypes of `RuntimException`.
 */
