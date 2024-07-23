package org.enso.interpreter.runtime.warning;

import com.oracle.truffle.api.CompilerDirectives.TruffleBoundary;
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Cached.Shared;
import com.oracle.truffle.api.dsl.Fallback;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.nodes.Node;
import java.util.Arrays;
import java.util.Comparator;
import org.enso.interpreter.dsl.AcceptsWarning;
import org.enso.interpreter.dsl.BuiltinMethod;
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.data.hash.HashMapInsertNode;
import org.enso.interpreter.runtime.data.vector.ArrayLikeAtNode;
import org.enso.interpreter.runtime.data.vector.ArrayLikeHelpers;
import org.enso.interpreter.runtime.data.vector.ArrayLikeLengthNode;

@BuiltinMethod(
    type = "Warning",
    name = "get_all_vector",
    description = "Gets all the warnings associated with the value.",
    autoRegister = false)
public abstract class GetAllWarningsNode extends Node {

  public static GetAllWarningsNode build() {
    return GetAllWarningsNodeGen.create();
  }

  public abstract Object execute(@AcceptsWarning Object value, boolean shouldWrap);

  @Specialization
  Object doWithWarn(
      WithWarnings value,
      boolean shouldWrap,
      @Shared @CachedLibrary(limit = "3") WarningsLibrary warningsLib,
      @CachedLibrary(limit = "3") InteropLibrary interop,
      @Cached HashMapInsertNode mapInsertNode,
      @Cached ArrayLikeLengthNode lengthNode,
      @Cached ArrayLikeAtNode atNode) {
    var warns =
        value.getWarningsArray(shouldWrap, warningsLib, mapInsertNode, interop, lengthNode, atNode);
    sortArray(warns);
    return ArrayLikeHelpers.asVectorEnsoObjects(warns);
  }

  @Fallback
  Object doGeneric(
      Object value,
      boolean shouldWrap,
      @Shared @CachedLibrary(limit = "3") WarningsLibrary warningsLib) {
    assert !(value instanceof WithWarnings);
    if (warningsLib.hasWarnings(value)) {
      try {
        Warning[] warnings = warningsLib.getWarnings(value, null, shouldWrap);
        sortArray(warnings);
        return ArrayLikeHelpers.asVectorEnsoObjects(warnings);
      } catch (UnsupportedMessageException e) {
        throw EnsoContext.get(warningsLib).raiseAssertionPanic(warningsLib, null, e);
      }
    } else {
      return ArrayLikeHelpers.asVectorEmpty();
    }
  }

  @TruffleBoundary
  private static void sortArray(Warning[] arr) {
    Arrays.sort(arr, Comparator.comparing(Warning::getSequenceId).reversed());
  }
}
