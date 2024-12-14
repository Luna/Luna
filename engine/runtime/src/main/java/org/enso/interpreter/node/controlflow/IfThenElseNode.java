package org.enso.interpreter.node.controlflow;

import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Cached.Shared;
import com.oracle.truffle.api.dsl.Fallback;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.TruffleObject;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.nodes.Node.Child;
import com.oracle.truffle.api.nodes.NodeInfo;
import com.oracle.truffle.api.profiles.InlinedCountingConditionProfile;
import java.util.Objects;
import org.enso.interpreter.node.ExpressionNode;
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.data.EnsoObject;
import org.enso.interpreter.runtime.error.DataflowError;
import org.enso.interpreter.runtime.error.PanicException;
import org.enso.interpreter.runtime.error.PanicSentinel;
import org.enso.interpreter.runtime.warning.AppendWarningNode;
import org.enso.interpreter.runtime.warning.WarningsLibrary;

@NodeInfo(
    shortName = "if_then_else",
    description = "The runtime representation of a if then else expression.")
public final class IfThenElseNode extends ExpressionNode {
  private @Child ExpressionNode cond;
  private @Child ExpressionNode trueBranch;
  private @Child ExpressionNode falseBranch;
  private @Child WithCondition with;

  IfThenElseNode(ExpressionNode cond, ExpressionNode trueBranch, ExpressionNode falseBranch) {
    this.cond = Objects.requireNonNull(cond);
    this.trueBranch = Objects.requireNonNull(trueBranch);
    this.falseBranch = falseBranch;
    this.with = IfThenElseNodeFactory.WithConditionNodeGen.create();
  }

  public static IfThenElseNode build(ExpressionNode c, ExpressionNode t, ExpressionNode fOrNull) {
    return new IfThenElseNode(c, t, fOrNull);
  }

  @Override
  public Object executeGeneric(VirtualFrame frame) {
    var condValue = cond.executeGeneric(frame);
    var result = with.executeIf(frame, condValue, trueBranch, falseBranch);
    return result;
  }

  abstract static class WithCondition extends Node {
    WithCondition() {}

    abstract Object executeIf(
        VirtualFrame frame, Object cond, ExpressionNode trueBranch, ExpressionNode falseBranch);

    @Specialization
    final Object doBoolean(
        VirtualFrame frame,
        boolean cond,
        ExpressionNode trueBranch,
        ExpressionNode falseBranch,
        @Shared("profile") @Cached InlinedCountingConditionProfile profile) {
      if (cond) {
        profile.wasTrue(this);
        return trueBranch.executeGeneric(frame);
      } else {
        profile.wasFalse(this);
        if (falseBranch == null) {
          var ctx = EnsoContext.get(this);
          return ctx.getBuiltins().nothing();
        } else {
          return falseBranch.executeGeneric(frame);
        }
      }
    }

    static boolean notEnsoObject(Object o) {
      return !(o instanceof EnsoObject);
    }

    @Specialization(
        limit = "3",
        guards = {"notEnsoObject(foreignObj)", "iop.isBoolean(foreignObj)"})
    final Object doTruffleBoolean(
        VirtualFrame frame,
        TruffleObject foreignObj,
        ExpressionNode trueBranch,
        ExpressionNode falseBranch,
        @CachedLibrary("foreignObj") InteropLibrary iop,
        @Shared("profile") @Cached InlinedCountingConditionProfile profile) {
      try {
        var cond = iop.asBoolean(foreignObj);
        return doBoolean(frame, cond, trueBranch, falseBranch, profile);
      } catch (UnsupportedMessageException ex) {
        var ctx = EnsoContext.get(this);
        throw ctx.raiseAssertionPanic(this, "Expecting boolean", ex);
      }
    }

    @Specialization(
        limit = "3",
        guards = {"cond != null", "warnings.hasWarnings(cond)"})
    final Object doWarning(
        VirtualFrame frame,
        Object cond,
        ExpressionNode trueBranch,
        ExpressionNode falseBranch,
        @CachedLibrary(value = "cond") WarningsLibrary warnings,
        @Cached AppendWarningNode appendWarningNode,
        @Cached WithCondition delegate) {
      try {
        var ws = warnings.getWarnings(cond, false);
        var without = warnings.removeWarnings(cond);

        var result = delegate.executeIf(frame, without, trueBranch, falseBranch);
        return appendWarningNode.executeAppend(frame, result, ws);
      } catch (UnsupportedMessageException e) {
        var ctx = EnsoContext.get(this);
        throw ctx.raiseAssertionPanic(this, null, e);
      }
    }

    @Specialization
    final Object doError(
        VirtualFrame frame,
        DataflowError cond,
        ExpressionNode trueBranch,
        ExpressionNode falseBranch) {
      return cond;
    }

    @Specialization
    final Object doPanicSentinel(
        VirtualFrame frame,
        PanicSentinel cond,
        ExpressionNode trueBranch,
        ExpressionNode falseBranch) {
      CompilerDirectives.transferToInterpreter();
      throw cond;
    }

    @Fallback
    @CompilerDirectives.TruffleBoundary
    final PanicException doOther(Object cond, ExpressionNode trueBranch, ExpressionNode falseBranch)
        throws PanicException {
      var ctx = EnsoContext.get(this);
      throw ctx.raiseAssertionPanic(this, "Expecting boolean but got " + cond, null);
    }
  }
}
