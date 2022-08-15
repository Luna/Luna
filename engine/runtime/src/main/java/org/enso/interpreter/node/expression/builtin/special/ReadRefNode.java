package org.enso.interpreter.node.expression.builtin.special;

import com.oracle.truffle.api.nodes.Node;
import org.enso.interpreter.dsl.BuiltinMethod;
import org.enso.interpreter.runtime.data.Ref;

@BuiltinMethod(type = "Special", name = "<read_ref>")
public class ReadRefNode extends Node {
  public Object execute(Ref self) {
    return self.getValue();
  }
}
