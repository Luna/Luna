package org.enso.interpreter.node.expression.builtin.error;

import com.oracle.truffle.api.TruffleStackTrace;
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.exception.AbstractTruffleException;
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.profiles.BranchProfile;
import com.oracle.truffle.api.profiles.CountingConditionProfile;
import org.enso.interpreter.dsl.BuiltinMethod;
import org.enso.interpreter.dsl.Suspend;
import org.enso.interpreter.node.BaseNode;
import org.enso.interpreter.node.callable.InvokeCallableNode;
import org.enso.interpreter.node.callable.thunk.ThunkExecutorNode;
import org.enso.interpreter.node.expression.builtin.meta.IsValueOfTypeNode;
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.callable.argument.CallArgumentInfo;
import org.enso.interpreter.runtime.data.atom.AtomNewInstanceNode;
import org.enso.interpreter.runtime.error.PanicException;
import org.enso.interpreter.runtime.error.PanicSentinel;
import org.enso.interpreter.runtime.state.State;

@BuiltinMethod(
    type = "Panic",
    name = "catch",
    description = "Executes an action if a panic was thrown, calls the provided callback.")
public abstract class CatchPanicNode extends Node {
  private @Child InvokeCallableNode invokeCallableNode;
  private @Child ThunkExecutorNode thunkExecutorNode = ThunkExecutorNode.build();
  private @Child IsValueOfTypeNode isValueOfTypeNode = IsValueOfTypeNode.build();
  private final CountingConditionProfile profile = CountingConditionProfile.create();

  CatchPanicNode() {
    this.invokeCallableNode =
        InvokeCallableNode.build(
            new CallArgumentInfo[] {new CallArgumentInfo()},
            InvokeCallableNode.DefaultsExecutionMode.EXECUTE,
            InvokeCallableNode.ArgumentsExecutionMode.PRE_EXECUTED);
    // Note [Tail call]
    this.invokeCallableNode.setTailStatus(BaseNode.TailStatus.TAIL_DIRECT);
  }

  static CatchPanicNode build() {
    return CatchPanicNodeGen.create();
  }

  abstract Object execute(
      VirtualFrame frame, State state, Object panicType, @Suspend Object action, Object handler);

  @Specialization
  Object doExecute(
      VirtualFrame frame,
      State state,
      Object panicType,
      Object action,
      Object handler,
      @Cached BranchProfile panicBranchProfile,
      @Cached BranchProfile otherExceptionBranchProfile,
      @CachedLibrary(limit = "3") InteropLibrary interop) {
    try {
      // Note [Tail call]
      var ret = thunkExecutorNode.executeThunk(frame, action, state, BaseNode.TailStatus.NOT_TAIL);
      if (ret instanceof PanicSentinel sentinel) {
        throw sentinel.getPanic();
      }
      return ret;
    } catch (PanicException e) {
      panicBranchProfile.enter();
      Object payload = e.getPayload();
      return executeCallbackOrRethrow(frame, state, panicType, handler, payload, e, interop);
    } catch (AbstractTruffleException e) {
      otherExceptionBranchProfile.enter();
      return executeCallbackOrRethrow(frame, state, panicType, handler, e, e, interop);
    }
  }

  private Object executeCallbackOrRethrow(
      VirtualFrame frame,
      State state,
      Object panicType,
      Object handler,
      Object payload,
      AbstractTruffleException originalException,
      InteropLibrary interopLibrary) {

    if (profile.profile(isValueOfTypeNode.execute(panicType, payload, true))) {
      var builtins = EnsoContext.get(this).getBuiltins();
      var cons = builtins.caughtPanic().getUniqueConstructor();
      if (originalException instanceof PanicException panic) {
        panic.assignCaughtLocation(this);
      } else {
        // materializes stack trace of non-Enso
        // exceptions in case it is needed by the handler
        TruffleStackTrace.fillIn(originalException);
      }
      var caughtPanic =
          AtomNewInstanceNode.getUncached().newInstance(cons, payload, originalException);
      return invokeCallableNode.execute(handler, frame, state, new Object[] {caughtPanic});
    } else {
      try {
        return interopLibrary.throwException(originalException);
      } catch (UnsupportedMessageException e) {
        throw EnsoContext.get(this).raiseAssertionPanic(this, null, e);
      }
    }
  }

  /* Note [Tail call]
   * ~~~~~~~~~~~~~~~~~~~~~~
   * The `NOT_TAIL` in `isTail` parameter is important here. Panic.catch cannot be in
   * the tail call position. If it is, the panic may not be caught when a tail-call-optimized
   * thunk is evaluated (as that will effectively discard this method call from the stack).
   *
   * This is important for the `action` parameter of `Panic.catch`. The `handler` callback can
   * be executed as tail, as there is nothing in this class that needs to run after the `handler`.
   */
}
