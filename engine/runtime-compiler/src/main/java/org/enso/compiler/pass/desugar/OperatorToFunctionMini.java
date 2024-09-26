package org.enso.compiler.pass.desugar;

import org.enso.compiler.core.IR;
import org.enso.compiler.core.ir.CallArgument;
import org.enso.compiler.core.ir.expression.Application;
import org.enso.compiler.core.ir.expression.Operator;
import org.enso.compiler.pass.MiniIRPass;
import scala.collection.mutable.ListBuffer;

public class OperatorToFunctionMini extends MiniIRPass {
  OperatorToFunctionMini() {}

  @Override
  public IR transformIr(IR ir) {
    if (ir instanceof Operator.Binary binOp) {
      ListBuffer<CallArgument> args = new ListBuffer<>();
      args.addOne(binOp.left());
      args.addOne(binOp.right());
      return new Application.Prefix(
          binOp.operator(),
          args.toList(),
          false,
          binOp.location(),
          binOp.passData(),
          binOp.diagnostics());
    }
    return ir;
  }
}