package org.enso.compiler.pass.test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;

import org.enso.compiler.core.IR;
import org.enso.compiler.core.ir.Expression;
import org.enso.compiler.pass.MiniIRPass;

final class MockMiniPass extends MiniIRPass {
  private final MockExpression stopExpr;

  /**
   * @param stopExpr When encountered this expression, {@code prepare} method will return null to
   *     signal that the traversal should stop. Can be null.
   */
  MockMiniPass(MockExpression stopExpr) {
    this.stopExpr = stopExpr;
  }

  @Override
  public Expression transformExpression(Expression expr) {
    if (expr instanceof MockExpression mockExpr) {
      if (mockExpr.hasParent()) {
        assertThat(
            "Prepare must be called on an expression with a parent",
            mockExpr.isPrepared(),
            is(true));
      }
      assertThat("Transform is called just once", mockExpr.isTransformed(), is(false));
      mockExpr.setTransformed(true);
    }
    return expr;
  }

  @Override
  public MiniIRPass prepare(IR parent, Expression child) {
    if (stopExpr == child) {
      return null;
    }
    if (child instanceof MockExpression mockExpr) {
      assertThat("Prepare is called just once", mockExpr.isPrepared(), is(false));
      mockExpr.setPrepared(true);
    }
    return this;
  }
}
