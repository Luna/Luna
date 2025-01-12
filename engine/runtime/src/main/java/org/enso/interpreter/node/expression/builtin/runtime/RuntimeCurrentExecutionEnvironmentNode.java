package org.enso.interpreter.node.expression.builtin.runtime;

import com.oracle.truffle.api.nodes.Node;
import org.enso.interpreter.dsl.BuiltinMethod;
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.data.text.Text;

@BuiltinMethod(
    type = "Runtime",
    name = "current_execution_environment",
    description = "Returns the name of the current execution environment.",
    autoRegister = false)
public class RuntimeCurrentExecutionEnvironmentNode extends Node {
  Object execute() {
    return Text.create(EnsoContext.get(this).getExecutionEnvironment().getName());
  }
}
