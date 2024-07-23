package org.enso.interpreter.runtime.warning;

import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Cached.Shared;
import com.oracle.truffle.api.dsl.GenerateUncached;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.frame.VirtualFrame;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.InvalidArrayIndexException;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.nodes.Node;
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.data.hash.EnsoHashMap;
import org.enso.interpreter.runtime.data.hash.HashMapInsertNode;
import org.enso.interpreter.runtime.data.vector.ArrayLikeAtNode;
import org.enso.interpreter.runtime.data.vector.ArrayLikeLengthNode;

@GenerateUncached
public abstract class AppendWarningNode extends Node {

  public static AppendWarningNode build() {
    return AppendWarningNodeGen.create();
  }

  /**
   * Appends a warning to the given object.
   *
   * @param object Object that will have the warning appended
   * @param warnings Either an array-like object containing warnings to append, or a single warning.
   *     It is expected that all the elements in the container are of {@link Warning} class.
   * @return A wrapped object with warnings
   */
  public abstract WithWarnings execute(VirtualFrame frame, Object object, Object warnings);

  @Specialization
  WithWarnings doWithWarnMultipleWarningsArray(
      VirtualFrame frame,
      WithWarnings withWarn,
      Warning[] warnings,
      @Shared @Cached HashMapInsertNode mapInsertNode) {
    var warnsMap = withWarn.warnings;
    var maxWarnsCnt = withWarn.maxWarnings;
    var isLimitReached = false;
    for (var warn : warnings) {
      if (warnsMap.getHashSize() < maxWarnsCnt) {
        warnsMap = mapInsertNode.execute(frame, warnsMap, warn.getSequenceId(), warn);
      } else {
        isLimitReached = true;
        break;
      }
    }
    return new WithWarnings(withWarn.value, withWarn.maxWarnings, isLimitReached, warnsMap);
  }

  @Specialization
  WithWarnings doGenericMultipleWarningsArray(
      VirtualFrame frame,
      Object object,
      Warning[] warnings,
      @Shared @Cached HashMapInsertNode mapInsertNode) {
    var warnsMap = EnsoHashMap.empty();
    var isLimitReached = false;
    var warnsLimit = EnsoContext.get(this).getWarningsLimit();
    for (var warn : warnings) {
      if (warnsMap.getHashSize() < warnsLimit) {
        warnsMap = mapInsertNode.execute(frame, warnsMap, warn.getSequenceId(), warn);
      } else {
        isLimitReached = true;
        break;
      }
    }
    return new WithWarnings(object, warnsLimit, isLimitReached, warnsMap);
  }

  @Specialization(guards = "interop.hasArrayElements(warnings)")
  WithWarnings doWithWarnMultipleWarningsInterop(
      VirtualFrame frame,
      WithWarnings withWarn,
      Object warnings,
      @Shared @CachedLibrary(limit = "3") InteropLibrary interop,
      @Shared @Cached HashMapInsertNode mapInsertNode,
      @Shared @Cached ArrayLikeAtNode atNode,
      @Shared @Cached ArrayLikeLengthNode lengthNode) {
    var warnsLimit = withWarn.maxWarnings;
    var resWarningMap =
        insertToWarningMap(
            frame, withWarn.warnings, warnings, warnsLimit, lengthNode, atNode, mapInsertNode);
    var currWarnsCnt = withWarn.warnings.getHashSize();
    var newWarnsCnt = lengthNode.executeLength(warnings);
    var isLimitReached = currWarnsCnt + newWarnsCnt >= withWarn.maxWarnings;
    return new WithWarnings(withWarn.value, withWarn.maxWarnings, isLimitReached, resWarningMap);
  }

  @Specialization(guards = {"!interop.hasArrayElements(warning)", "!isWarnArray(warning)"})
  WithWarnings doWithWarnSingleWarning(
      VirtualFrame frame,
      WithWarnings withWarn,
      Warning warning,
      @Shared @CachedLibrary(limit = "3") InteropLibrary interop,
      @Shared @Cached HashMapInsertNode mapInsertNode) {
    var warningsMap = withWarn.warnings;
    EnsoHashMap newWarnsMap;
    boolean isLimitReached;
    if (warningsMap.getHashSize() < withWarn.maxWarnings) {
      newWarnsMap = mapInsertNode.execute(frame, warningsMap, warning.getSequenceId(), warning);
      isLimitReached = false;
    } else {
      newWarnsMap = withWarn.warnings;
      isLimitReached = true;
    }
    return new WithWarnings(withWarn.value, withWarn.maxWarnings, isLimitReached, newWarnsMap);
  }

  @Specialization(guards = {"!interop.hasArrayElements(warning)", "!isWarnArray(warning)"})
  WithWarnings doGenericSingleWarning(
      VirtualFrame frame,
      Object value,
      Warning warning,
      @Shared @CachedLibrary(limit = "3") InteropLibrary interop,
      @Shared @Cached HashMapInsertNode mapInsertNode) {
    var warnsMap =
        mapInsertNode.execute(frame, EnsoHashMap.empty(), warning.getSequenceId(), warning);
    var warnsLimit = EnsoContext.get(this).getWarningsLimit();
    var limitReached = 1 >= warnsLimit;
    return new WithWarnings(value, warnsLimit, limitReached, warnsMap);
  }

  @Specialization(guards = "interop.hasArrayElements(warnings)")
  WithWarnings doGenericMultipleWarnings(
      VirtualFrame frame,
      Object object,
      Object warnings,
      @Shared @CachedLibrary(limit = "3") InteropLibrary interop,
      @Shared @Cached ArrayLikeLengthNode lengthNode,
      @Shared @Cached ArrayLikeAtNode atNode,
      @Shared @Cached HashMapInsertNode mapInsertNode) {
    var warnsLimit = EnsoContext.get(this).getWarningsLimit();
    var resWarningMap =
        insertToWarningMap(
            frame, EnsoHashMap.empty(), warnings, warnsLimit, lengthNode, atNode, mapInsertNode);
    var newWarnsCnt = lengthNode.executeLength(warnings);
    var isLimitReached = newWarnsCnt >= warnsLimit;
    return new WithWarnings(object, warnsLimit, isLimitReached, resWarningMap);
  }

  /** Inserts all {@code warnings} to the {@code initialWarningMap}. */
  private EnsoHashMap insertToWarningMap(
      VirtualFrame frame,
      EnsoHashMap initialWarningMap,
      Object warnings,
      int warnsLimit,
      ArrayLikeLengthNode lengthNode,
      ArrayLikeAtNode atNode,
      HashMapInsertNode mapInsertNode) {
    EnsoHashMap resWarningMap = initialWarningMap;
    for (long i = 0; i < lengthNode.executeLength(warnings); i++) {
      Warning warn;
      try {
        warn = (Warning) atNode.executeAt(warnings, i);
      } catch (InvalidArrayIndexException e) {
        throw CompilerDirectives.shouldNotReachHere(e);
      } catch (ClassCastException e) {
        throw EnsoContext.get(this).raiseAssertionPanic(this, "Expected warning object", e);
      }
      if (resWarningMap.getHashSize() >= warnsLimit) {
        return resWarningMap;
      }
      resWarningMap = mapInsertNode.execute(frame, resWarningMap, warn.getSequenceId(), warn);
    }
    return resWarningMap;
  }

  protected static boolean isWarnArray(Object obj) {
    return obj instanceof Warning[];
  }
}
