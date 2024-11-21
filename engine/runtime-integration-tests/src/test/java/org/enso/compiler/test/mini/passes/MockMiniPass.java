package org.enso.compiler.test.mini.passes;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;

import java.util.HashSet;
import java.util.Objects;
import java.util.Set;
import org.enso.compiler.core.IR;
import org.enso.compiler.core.ir.Expression;
import org.enso.compiler.pass.IRProcessingPass;
import org.enso.compiler.pass.MiniIRPass;
import org.enso.compiler.test.mini.passes.Event.Kind;
import scala.collection.immutable.Seq;
import scala.jdk.javaapi.CollectionConverters;

final class MockMiniPass extends MiniIRPass implements IRProcessingPass {
  private final MockExpression stopExpr;
  private final EventRecorder eventRecorder;
  private final Set<MockMiniPass> precursorPasses;
  private final Set<MockMiniPass> invalidatedPasses = new HashSet<>();

  /**
   * @param stopExpr          When encountered this expression, {@code prepare} method will return
   *                          null to signal that the traversal should stop. Can be null.
   * @param eventRecorder     Recorder of {@code prepare} and {@code transform} events. May be null
   * @param precursorPasses
   */
  private MockMiniPass(MockExpression stopExpr, EventRecorder eventRecorder,
      Set<MockMiniPass> precursorPasses) {
    this.stopExpr = stopExpr;
    this.eventRecorder = eventRecorder;
    this.precursorPasses = precursorPasses;
  }

  static Builder builder() {
    return new Builder();
  }

  void addInvalidatedPass(MockMiniPass pass) {
    invalidatedPasses.add(pass);
  }

  @Override
  public Expression transformExpression(Expression expr) {
    if (expr instanceof MockExpression mockExpr) {
      if (mockExpr.hasParent()) {
        assertThat(
            "Prepare must be called on an expression with a parent",
            mockExpr.isPreparedBy(this),
            is(true));
      }
      assertThat(
          "Transform is called just once by one pass", mockExpr.isTransformedBy(this), is(false));
      mockExpr.setTransformedByPass(this);
      if (eventRecorder != null) {
        eventRecorder.record(Kind.Transform, this, mockExpr);
      }
    }
    return expr;
  }

  @Override
  public MiniIRPass prepare(IR parent, Expression child) {
    if (stopExpr == child) {
      return null;
    }
    if (child instanceof MockExpression mockExpr) {
      assertThat("Prepare is called just once by one pass", mockExpr.isPreparedBy(this), is(false));
      mockExpr.setPreparedBy(this);
      if (eventRecorder != null) {
        eventRecorder.record(Kind.Prepare, this, mockExpr);
      }
    }
    return this;
  }

  @Override
  public Seq<? extends IRProcessingPass> precursorPasses() {
    return CollectionConverters.asScala(precursorPasses).toSeq();
  }

  @Override
  public Seq<? extends IRProcessingPass> invalidatedPasses() {
    return CollectionConverters.asScala(invalidatedPasses).toSeq();
  }


  static final class Builder {
    private MockExpression stopExpr;
    private EventRecorder eventRecorder;
    private Set<MockMiniPass> precursorPasses = new HashSet<>();

    Builder stopExpr(MockExpression stopExpr) {
      this.stopExpr = stopExpr;
      return this;
    }

    Builder eventRecorder(EventRecorder eventRecorder) {
      this.eventRecorder = eventRecorder;
      return this;
    }

    Builder precursorPasses(Set<MockMiniPass> precursorPasses) {
      this.precursorPasses = precursorPasses;
      return this;
    }

    MockMiniPass build() {
      Objects.requireNonNull(precursorPasses);
      return new MockMiniPass(stopExpr, eventRecorder, precursorPasses);
    }
  }
}
