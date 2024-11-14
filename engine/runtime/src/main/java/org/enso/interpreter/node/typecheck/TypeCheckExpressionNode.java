package org.enso.interpreter.node.typecheck;

import com.oracle.truffle.api.frame.VirtualFrame;
import org.enso.interpreter.node.ExpressionNode;

final class TypeCheckExpressionNode extends ExpressionNode {

  @Child private ExpressionNode original;
  @Child private ReadArgumentCheckNode check;

  TypeCheckExpressionNode(ExpressionNode original, ReadArgumentCheckNode check) {
    this.check = check;
    this.original = original;
  }

  ExpressionNode getOriginal() {
    return original;
  }

  @Override
  public Object executeGeneric(VirtualFrame frame) {
    java.lang.Object value = original.executeGeneric(frame);
    java.lang.Object result = check.handleCheckOrConversion(frame, value);
    return result;
  }

  @Override
  public boolean isInstrumentable() {
    return false;
  }
}
