package org.enso.interpreter.node.expression.builtin.meta;

import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.nodes.Node;
import org.enso.interpreter.dsl.BuiltinMethod;
import org.enso.interpreter.node.expression.builtin.mutable.CoerceArrayNode;
import org.enso.interpreter.runtime.data.struct.Struct;
import org.enso.interpreter.runtime.data.struct.AtomConstructor;

@BuiltinMethod(
    type = "Meta",
    name = "new_atom",
    description = "Creates a new atom with given constructor and fields.",
    autoRegister = false)
public abstract class NewAtomInstanceNode extends Node {

  static NewAtomInstanceNode build() {
    return NewAtomInstanceNodeGen.create();
  }

  abstract Struct execute(AtomConstructor constructor, Object fields);

  @Specialization
  Struct doExecute(AtomConstructor constructor, Object fields, @Cached CoerceArrayNode coerce) {
    return constructor.newInstance(coerce.execute(fields));
  }
}
