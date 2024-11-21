package org.enso.interpreter.node.expression.builtin.meta;

import com.oracle.truffle.api.dsl.GenerateUncached;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.nodes.Node;
import org.enso.interpreter.dsl.AcceptsError;
import org.enso.interpreter.dsl.AcceptsWarning;
import org.enso.interpreter.dsl.BuiltinMethod;
import org.enso.interpreter.runtime.library.dispatch.TypeOfNode;
import org.enso.interpreter.runtime.warning.WarningsLibrary;

@BuiltinMethod(
    type = "Meta",
    name = "type_of",
    description = "Returns the type of a value.",
    autoRegister = false)
@GenerateUncached
public final class TypeOfBuiltin extends Node {
  private @Child WarningsLibrary warnings = WarningsLibrary.getFactory().createDispatched(11);
  private @Child TypeOfNode typeOf = TypeOfNode.create();

  private TypeOfBuiltin() {}

  public Object execute(@AcceptsError @AcceptsWarning Object value) {
    if (warnings.hasWarnings(value)) {
      try {
        value = warnings.removeWarnings(value);
      } catch (UnsupportedMessageException ex) {
        // keep the old value
      }
    }
    return typeOf.findTypeOrError(value);
  }

  public static TypeOfBuiltin build() {
    return new TypeOfBuiltin();
  }
}
