package org.enso.interpreter.runtime.data.vector;

import com.oracle.truffle.api.CompilerDirectives.TruffleBoundary;
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Cached.Shared;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.profiles.BranchProfile;
import org.enso.interpreter.dsl.BuiltinMethod;
import org.enso.interpreter.node.callable.dispatch.InvokeFunctionNode;
import org.enso.interpreter.node.expression.builtin.error.ProblemBehavior;
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.callable.function.Function;
import org.enso.interpreter.runtime.data.atom.Atom;
import org.enso.interpreter.runtime.error.DataflowError;
import org.enso.interpreter.runtime.error.PanicException;
import org.enso.interpreter.runtime.library.dispatch.TypesLibrary;
import org.enso.interpreter.runtime.state.HasContextEnabledNode;
import org.enso.interpreter.runtime.state.State;
import org.enso.interpreter.runtime.warning.AppendWarningNode;
import org.enso.interpreter.runtime.warning.Warning;
import org.enso.interpreter.runtime.warning.WarningsLibrary;

@BuiltinMethod(
    type = "Array_Like_Helpers",
    name = "vector_from_function",
    description = "Creates a vector from a function.")
public abstract class VectorFromFunctionNode extends Node {
  public static VectorFromFunctionNode build() {
    return VectorFromFunctionNodeGen.create();
  }

  private static final int MAX_MAP_WARNINGS = 10;

  /**
   * @param length Length of the vector to create.
   * @param func Callback function called with index as argument.
   * @param onProblems Can be either an atom of type {@code Problem_Behavior} or {@code No_Wrap}
   *     type.
   * @return Vector constructed from the given function.
   */
  abstract Object execute(
      VirtualFrame frame, State state, long length, Function func, Object onProblems);

  @Specialization(guards = "onProblemsAtom == onProblemsAtomCached", limit = "3")
  Object doItCached(
      VirtualFrame frame,
      State state,
      long length,
      Function func,
      Object onProblemsAtom,
      @Cached("onProblemsAtom") Object onProblemsAtomCached,
      @Shared @Cached("buildWithArity(1)") InvokeFunctionNode invokeFunctionNode,
      @Shared @Cached("build()") AppendWarningNode appendWarningNode,
      @Shared @CachedLibrary(limit = "3") WarningsLibrary warnsLib,
      @Shared @CachedLibrary(limit = "3") TypesLibrary typesLib,
      @Shared @Cached BranchProfile errorEncounteredProfile,
      @Shared @Cached HasContextEnabledNode hasContextEnabledNode) {
    return doIt(
        frame,
        state,
        length,
        func,
        onProblemsAtomCached,
        warnsLib,
        typesLib,
        invokeFunctionNode,
        appendWarningNode,
        errorEncounteredProfile,
        hasContextEnabledNode);
  }

  @Specialization(replaces = "doItCached")
  Object doItUncached(
      VirtualFrame frame,
      State state,
      long length,
      Function func,
      Object onProblemsAtom,
      @Shared @Cached("buildWithArity(1)") InvokeFunctionNode invokeFunctionNode,
      @Shared @Cached("build()") AppendWarningNode appendWarningNode,
      @Shared @CachedLibrary(limit = "3") WarningsLibrary warnsLib,
      @Shared @CachedLibrary(limit = "3") TypesLibrary typesLib,
      @Shared @Cached BranchProfile errorEncounteredProfile,
      @Shared @Cached HasContextEnabledNode hasContextEnabledNode) {
    return doIt(
        frame,
        state,
        length,
        func,
        onProblemsAtom,
        warnsLib,
        typesLib,
        invokeFunctionNode,
        appendWarningNode,
        errorEncounteredProfile,
        hasContextEnabledNode);
  }

  private Object doIt(
      VirtualFrame frame,
      State state,
      long length,
      Function func,
      Object onProblemsAtom,
      WarningsLibrary warnsLib,
      TypesLibrary typesLib,
      InvokeFunctionNode invokeFunctionNode,
      AppendWarningNode appendWarningNode,
      BranchProfile errorEncounteredProfile,
      HasContextEnabledNode hasContextEnabledNode) {
    var ctx = EnsoContext.get(this);
    var onProblems = processOnProblemsArg(onProblemsAtom, typesLib);
    var len = Math.toIntExact(length);
    var nothing = ctx.getNothing();
    var target = ArrayBuilder.newBuilder(len);
    var errorsEncountered = 0;
    for (int i = 0; i < len; i++) {
      var value = invokeFunctionNode.execute(func, frame, state, new Long[] {(long) i});
      Object valueToAdd = value;
      if (value instanceof DataflowError err) {
        errorEncounteredProfile.enter();
        switch (onProblems) {
          case IGNORE -> valueToAdd = nothing;
          case REPORT_ERROR -> {
            var mapErr = ctx.getBuiltins().error().makeMapError(i, err.getPayload());
            return DataflowError.withDefaultTrace(state, mapErr, this, hasContextEnabledNode);
          }
          case REPORT_WARNING -> {
            errorsEncountered++;
            if (errorsEncountered > MAX_MAP_WARNINGS) {
              valueToAdd = nothing;
            } else {
              var wrappedInWarn =
                  Warning.attach(ctx, nothing, err.getPayload(), null, appendWarningNode);
              valueToAdd = wrappedInWarn;
            }
          }
          case NO_WRAP -> {
            return err;
          }
        }
      }
      target.add(valueToAdd, warnsLib);
    }
    var vector = target.asVector(true);
    if (errorsEncountered >= MAX_MAP_WARNINGS) {
      var additionalWarnsBuiltin = ctx.getBuiltins().additionalWarnings();
      long additionalWarnsCnt = errorsEncountered - MAX_MAP_WARNINGS;
      var additionalWarns = additionalWarnsBuiltin.newInstance(additionalWarnsCnt);
      var vecWithAdditionalWarns =
          Warning.attach(ctx, vector, additionalWarns, null, appendWarningNode);
      return vecWithAdditionalWarns;
    } else {
      return vector;
    }
  }

  private OnProblems processOnProblemsArg(Object onProblems, TypesLibrary typesLib) {
    var ctx = EnsoContext.get(this);
    var problemBehaviorBuiltin = ctx.getBuiltins().problemBehavior();
    var noWrapBuiltin = ctx.getBuiltins().noWrap();
    if (onProblems instanceof Atom onProblemsAtom) {
      if (isIgnore(onProblemsAtom, problemBehaviorBuiltin)) {
        return OnProblems.IGNORE;
      } else if (isReportError(onProblemsAtom, problemBehaviorBuiltin)) {
        return OnProblems.REPORT_ERROR;
      } else if (isReportWarning(onProblemsAtom, problemBehaviorBuiltin)) {
        return OnProblems.REPORT_WARNING;
      }
    }
    if (!typesLib.hasType(onProblems)) {
      throw makeTypeError(problemBehaviorBuiltin.getType(), onProblems, "onProblems");
    }
    var onProblemsType = typesLib.getType(onProblems);
    if (onProblemsType == noWrapBuiltin) {
      return OnProblems.NO_WRAP;
    }
    throw makeTypeError(problemBehaviorBuiltin.getType(), onProblems, "onProblems");
  }

  @TruffleBoundary
  private PanicException makeTypeError(Object expected, Object actual, String name) {
    var ctx = EnsoContext.get(this);
    var typeError = ctx.getBuiltins().error().makeTypeError(expected, actual, name);
    return new PanicException(typeError, this);
  }

  private static boolean isReportWarning(Atom onProblems, ProblemBehavior problemBehaviorBuiltin) {
    return onProblems.getConstructor() == problemBehaviorBuiltin.getReportWarning();
  }

  private static boolean isReportError(Atom onProblems, ProblemBehavior problemBehaviorBuiltin) {
    return onProblems.getConstructor() == problemBehaviorBuiltin.getReportError();
  }

  private static boolean isIgnore(Atom onProblems, ProblemBehavior problemBehaviorBuiltin) {
    return onProblems.getConstructor() == problemBehaviorBuiltin.getIgnore();
  }

  private enum OnProblems {
    IGNORE,
    REPORT_ERROR,
    REPORT_WARNING,
    NO_WRAP
  }
}
