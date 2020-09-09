package org.enso.interpreter.node.expression.builtin.number.bigInteger;

import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.nodes.Node;
import org.enso.interpreter.dsl.BuiltinMethod;
import org.enso.interpreter.node.expression.builtin.number.utils.BigIntegerOps;
import org.enso.interpreter.node.expression.builtin.number.utils.ToLongNode;

import java.math.BigInteger;

@BuiltinMethod(type = "Big_Integer", name = "%", description = "Big integer modulo division.")
public abstract class ModNode extends Node {
  private @Child ToLongNode toLongNode = ToLongNode.build();

  abstract Object execute(BigInteger _this, Object that);

  static ModNode build() {
    return ModNodeGen.create();
  }

  @Specialization
  Object doLong(BigInteger _this, long that) {
    return toLongNode.execute(BigIntegerOps.modulo(_this, that));
  }

  @Specialization
  Object doBigInteger(BigInteger _this, BigInteger that) {
    return toLongNode.execute(BigIntegerOps.modulo(_this, that));
  }
}
