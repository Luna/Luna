package org.enso.interpreter.node.expression.builtin.error.displaytext;

import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.nodes.UnexpectedResultException;
import org.enso.interpreter.dsl.BuiltinMethod;
import org.enso.interpreter.node.expression.builtin.text.util.TypeToDisplayTextNode;
import org.enso.interpreter.runtime.callable.atom.Atom;
import org.enso.interpreter.runtime.callable.atom.AtomConstructor;
import org.enso.interpreter.runtime.data.text.Text;
import org.enso.interpreter.runtime.type.TypesGen;

@BuiltinMethod(type = "Inexhaustive_Pattern_Match_Error", name = "to_display_text")
public abstract class InexhaustivePatternMatchErrorToDisplayTextNode extends Node {
  static InexhaustivePatternMatchErrorToDisplayTextNode build() {
    return InexhaustivePatternMatchErrorToDisplayTextNodeGen.create();
  }

  abstract Text execute(Object _this);

  @Specialization
  Text doAtom(Atom _this, @Cached TypeToDisplayTextNode displayTypeNode) {
    return Text.create("Inexhaustive pattern match: no branch matches ")
        .add(displayTypeNode.execute(_this.getFields()[0]))
        .add(".");
  }

  @Specialization
  Text doConstructor(AtomConstructor _this) {
    return Text.create("Inexhaustive pattern match.");
  }
}
