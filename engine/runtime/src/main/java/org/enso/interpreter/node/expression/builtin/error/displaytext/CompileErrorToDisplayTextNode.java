package org.enso.interpreter.node.expression.builtin.error.displaytext;

import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.nodes.UnexpectedResultException;
import org.enso.interpreter.dsl.BuiltinMethod;
import org.enso.interpreter.runtime.data.struct.Struct;
import org.enso.interpreter.runtime.data.struct.AtomConstructor;
import org.enso.interpreter.runtime.data.text.Text;
import org.enso.interpreter.runtime.type.TypesGen;

@BuiltinMethod(type = "Compile_Error", name = "to_display_text")
public abstract class CompileErrorToDisplayTextNode extends Node {
  static CompileErrorToDisplayTextNode build() {
    return CompileErrorToDisplayTextNodeGen.create();
  }

  abstract Text execute(Object self);

  @Specialization
  Text doAtom(Struct self) {
    try {
      return Text.create("Compile error: ", TypesGen.expectText(self.getFields()[0]));
    } catch (UnexpectedResultException e) {
      return Text.create("Compile error.");
    }
  }

  @Specialization
  Text doConstructor(AtomConstructor self) {
    return Text.create("Compile error.");
  }
}
