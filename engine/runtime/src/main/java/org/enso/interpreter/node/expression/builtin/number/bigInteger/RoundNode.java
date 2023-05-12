package org.enso.interpreter.node.expression.builtin.number.bigInteger;

import com.oracle.truffle.api.nodes.Node;
import org.enso.interpreter.dsl.BuiltinMethod;
import org.enso.interpreter.runtime.number.EnsoBigInteger;

@BuiltinMethod(type = "Big_Integer", name = "round", description = "Big integer round.")
public class RoundNode extends Node {
    Object execute(EnsoBigInteger self) {
        System.out.println("NOPE big");
        return self;
    }
}
