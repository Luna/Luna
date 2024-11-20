package org.enso.compiler.pass.test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;

import java.util.List;
import org.enso.compiler.pass.MiniIRPass;
import org.junit.Test;

public class MiniPassTraverserTest {
  @Test
  public void traversesOneExpression() {
    var expr = new MockExpression(false);
    var miniPass = new MockMiniPass(null);
    MiniIRPass.compile(MockExpression.class, expr, miniPass);
    assertThat("Prepare is called only for trees with depth > 1", expr.isPrepared(), is(false));
    assertThat(expr.isTransformed(), is(true));
  }

  @Test
  public void traversesExpressionWithOneChild() {
    var parentExpr = new MockExpression(false);
    var childExpr = new MockExpression(true);
    parentExpr.addChild(childExpr);
    var miniPass = new MockMiniPass(null);
    MiniIRPass.compile(MockExpression.class, parentExpr, miniPass);
    assertThat("Prepare must be called on a child expression", childExpr.isPrepared(), is(true));
    assertThat(childExpr.isTransformed(), is(true));
    assertThat(parentExpr.isTransformed(), is(true));
  }

  @Test
  public void traversesExpressionWithManyChildren() {
    var parentExpr = new MockExpression(false);
    var children = List.of(new MockExpression(true), new MockExpression(true));
    children.forEach(parentExpr::addChild);
    var miniPass = new MockMiniPass(null);
    MiniIRPass.compile(MockExpression.class, parentExpr, miniPass);
    for (var ch : children) {
      assertThat("Prepare must be called on a child expression", ch.isPrepared(), is(true));
      assertThat(ch.isTransformed(), is(true));
    }
    assertThat(parentExpr.isTransformed(), is(true));
  }

  @Test
  public void stopTraversingWhenPrepareReturnsNull() {
    var e1 = new MockExpression(false);
    var e2 = new MockExpression(true);
    var e3 = new MockExpression(true);
    e1.addChild(e2);
    e2.addChild(e3);
    // Should stop traversing when e3 is encountered.
    // Should only process e1 and e2, not e3
    var miniPass = new MockMiniPass(e3);
    MiniIRPass.compile(MockExpression.class, e1, miniPass);
    assertThat("e3 should not be processed", e3.isPrepared(), is(false));
    assertThat("e3 should not be processed", e3.isTransformed(), is(false));
    assertThat("e2 should still be processed", e2.isPrepared(), is(true));
    assertThat("e2 should still be processed", e2.isTransformed(), is(true));
  }
}
