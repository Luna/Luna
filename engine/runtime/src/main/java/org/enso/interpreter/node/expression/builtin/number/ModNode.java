package org.enso.interpreter.node.expression.builtin.number;

import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.nodes.NodeInfo;
import org.enso.interpreter.dsl.BuiltinMethod;

@BuiltinMethod(type = "Number", name = "%")
@NodeInfo(shortName = "Number.%", description = "Modulo operation for numbers.")
public class ModNode extends Node {
  public long execute(long self, long that) {
    return self % that;
  }
}
