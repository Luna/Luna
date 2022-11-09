package org.enso.interpreter.node.expression.builtin.mutable;

import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.CompilerDirectives.TruffleBoundary;
import com.oracle.truffle.api.dsl.Fallback;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.nodes.LoopNode;
import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.profiles.BranchProfile;
import java.util.Arrays;
import java.util.Comparator;
import org.enso.interpreter.dsl.BuiltinMethod;
import org.enso.interpreter.node.callable.dispatch.CallOptimiserNode;
import org.enso.interpreter.node.callable.dispatch.SimpleCallOptimiserNode;
import org.enso.interpreter.runtime.Context;
import org.enso.interpreter.runtime.data.struct.Struct;
import org.enso.interpreter.runtime.callable.function.Function;
import org.enso.interpreter.runtime.data.Array;
import org.enso.interpreter.runtime.error.PanicException;
import org.enso.interpreter.runtime.state.State;

@BuiltinMethod(type = "Array", name = "sort", description = "Sorts a mutable array in place.")
public abstract class SortNode extends Node {
  private @Child CallOptimiserNode callOptimiserNode = SimpleCallOptimiserNode.build();
  private @Child InvalidComparisonNode invalidComparisonNode = InvalidComparisonNode.build();
  private final BranchProfile resultProfile = BranchProfile.create();

  abstract Object execute(State state, Object self, Object comparator);

  static SortNode build() {
    return SortNodeGen.create();
  }

  @Specialization
  Object doSortFunction(State state, Array self, Function comparator) {
    Context context = Context.get(this);
    Comparator<Object> compare = getComparator(comparator, context, state);
    return runSort(compare, self, context);
  }

  @Specialization
  Object doAtomThis(State state, Struct self, Object that) {
    return Context.get(this).getBuiltins().nothing();
  }

  @Fallback
  Object doOther(State state, Object self, Object comparator) {
    CompilerDirectives.transferToInterpreter();
    var fun = Context.get(this).getBuiltins().function();
    throw new PanicException(
        Context.get(this).getBuiltins().error().makeTypeError(fun, comparator, "comparator"), this);
  }

  Object runSort(Comparator<Object> compare, Array self, Context context) {
    doSort(self.getItems(), compare);
    LoopNode.reportLoopCount(this, (int) self.length());
    return context.getBuiltins().nothing();
  }

  @TruffleBoundary
  void doSort(Object[] items, Comparator<Object> compare) {
    Arrays.sort(items, compare);
  }

  private SortComparator getComparator(Function comp, Context context, State state) {
    return new SortComparator(comp, context, this, state);
  }

  private class SortComparator implements Comparator<Object> {
    private final Function compFn;
    private final Context context;
    private final Struct less;
    private final Struct equal;
    private final Struct greater;
    private final SortNode outerThis;
    private final State state;

    SortComparator(Function compFn, Context context, SortNode outerThis, State state) {
      this.compFn = compFn;
      this.context = context;
      this.less = context.getBuiltins().ordering().newLess();
      this.equal = context.getBuiltins().ordering().newEqual();
      this.greater = context.getBuiltins().ordering().newGreater();
      this.outerThis = outerThis;
      this.state = state;
    }

    @Override
    public int compare(Object o1, Object o2) {
      var value = callOptimiserNode.executeDispatch(compFn, null, state, new Object[] {o1, o2});
      return convertResult(value);
    }

    private int convertResult(Object res) {
      if (res == less) {
        return -1;
      } else if (res == equal) {
        return 0;
      } else if (res == greater) {
        return 1;
      } else {
        resultProfile.enter();
        return invalidComparisonNode.execute(res);
      }
    }
  }
}
