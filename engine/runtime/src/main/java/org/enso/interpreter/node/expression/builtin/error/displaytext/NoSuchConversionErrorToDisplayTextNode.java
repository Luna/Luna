package org.enso.interpreter.node.expression.builtin.error.displaytext;

import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.nodes.Node;
import org.enso.interpreter.dsl.BuiltinMethod;
import org.enso.interpreter.node.expression.builtin.text.util.TypeToDisplayTextNode;
import org.enso.interpreter.runtime.callable.atom.Atom;
import org.enso.interpreter.runtime.callable.atom.AtomConstructor;
import org.enso.interpreter.runtime.data.text.Text;

@BuiltinMethod(type = "No_Such_Conversion_Error", name = "to_display_text")
public abstract class NoSuchConversionErrorToDisplayTextNode extends Node {
  static NoSuchConversionErrorToDisplayTextNode build() {
    return NoSuchConversionErrorToDisplayTextNodeGen.create();
  }

  abstract Text execute(Object self);

  @Specialization
  Text doAtom(Atom self, @Cached TypeToDisplayTextNode displayTypeNode) {
    return Text.create("Could not find a conversion from `")
        .add(displayTypeNode.execute(self.getFields()[1]))
        .add("` to `")
        .add(displayTypeNode.execute(self.getFields()[0]))
        .add("`");
  }

  @Specialization
  Text doConstructor(AtomConstructor self) {
    return Text.create("Conversion could not be found.");
  }
}
