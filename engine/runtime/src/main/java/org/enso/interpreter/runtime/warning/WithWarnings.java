package org.enso.interpreter.runtime.warning;

import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.dsl.Bind;
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Cached.Shared;
import com.oracle.truffle.api.interop.ArityException;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.InvalidArrayIndexException;
import com.oracle.truffle.api.interop.TruffleObject;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import com.oracle.truffle.api.library.Message;
import com.oracle.truffle.api.library.ReflectionLibrary;
import com.oracle.truffle.api.nodes.Node;
import org.enso.interpreter.node.callable.InteropMethodCallNode;
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.callable.UnresolvedSymbol;
import org.enso.interpreter.runtime.data.ArrayRope;
import org.enso.interpreter.runtime.data.EnsoObject;
import org.enso.interpreter.runtime.data.Type;
import org.enso.interpreter.runtime.data.hash.EnsoHashMap;
import org.enso.interpreter.runtime.data.hash.HashMapInsertNode;
import org.enso.interpreter.runtime.data.hash.HashMapInsertNodeGen;
import org.enso.interpreter.runtime.data.text.Text;
import org.enso.interpreter.runtime.data.vector.ArrayLikeAtNode;
import org.enso.interpreter.runtime.data.vector.ArrayLikeAtNodeGen;
import org.enso.interpreter.runtime.data.vector.ArrayLikeLengthNode;
import org.enso.interpreter.runtime.data.vector.ArrayLikeLengthNodeGen;
import org.enso.interpreter.runtime.error.PanicException;
import org.enso.interpreter.runtime.library.dispatch.TypesLibrary;
import org.enso.interpreter.runtime.state.State;

/**
 * Represents a typical Enso <em>value with warnings</em>. As much of care as possible is taken to
 * delegate all operations to the underlaying {@code value}. Warnings are considered {@link
 * InteropLibrary#isException exceptional values} - e.g. one can check for them in Java polyglot
 * code as:
 *
 * <pre>
 *  Value value = ...;
 *  if (value.fitsInLong() && value.isException()) {
 *    // probably an Integer with a warning
 *    try {
 *      warningMulti.throwException();
 *    } catch (PolyglotException ex) {
 *      System.out.println("Warnings attached to " + value.asLong() + " are " + ex.getMessage());
 *    }
 *  }
 * </pre>
 */
@ExportLibrary(TypesLibrary.class)
@ExportLibrary(WarningsLibrary.class)
@ExportLibrary(ReflectionLibrary.class)
@ExportLibrary(value = InteropLibrary.class, delegateTo = "value")
public final class WithWarnings implements EnsoObject {
  final Object value;
  /**
   * Internal storage for warnings is a PE-friendly hash map. The key is a sequence ID (gathered
   * from {@link EnsoContext#nextSequenceId()} and the value is the warning itself. Note that it
   * is essential that sequenceId is the key so that the warnings are not duplicated.
   */
  final EnsoHashMap warnings;

  private final boolean limitReached;
  final int maxWarnings;

  /**
   * Creates a new instance of value wrapped in warnings.
   *
   * @param value value to be wrapped in warnings
   * @param maxWarnings maximal number of warnings allowed to be attached to the value
   * @param warningsMap warnings originally attached to a value
   * @param limitReached if `true`, indicates that `warnings` have already been limited for a
   *     custom-method, `false` otherwise
   */
  WithWarnings(Object value, int maxWarnings, boolean limitReached, EnsoHashMap warningsMap) {
    assert isAcceptableValue(value);
    assert warningsMap.getHashSize() <= maxWarnings;
    if (limitReached) {
      assert warningsMap.getHashSize() == maxWarnings;
    }
    this.value = value;
    this.maxWarnings = maxWarnings;
    this.limitReached = limitReached || warningsMap.getHashSize() >= maxWarnings;
    this.warnings = warningsMap;
  }

  /**
   * Explicit creation of WithWarnings. Allows to set a specific {@code maxWarnings} count, which
   * cannot be achieved by using warning-handling nodes like {@link AppendWarningNode}. If
   * {@code maxWarnings} does not need to be set explicitly, use nodes to create WithWarning objects
   * instead.
   *
   * @param value value to be wrapped in warnings
   * @param maxWarnings maximal number of warnings allowed to be attached to the value
   * @param limitReached if `true`, no other warnings will be attached to the {@code value}.
   * @param warnings array of warnings to be attached to the {@code value}
   */
  public static WithWarnings create(
      Object  value,
      int maxWarnings,
      boolean limitReached,
      Warning[] warnings
  ) {
    assert warnings.length <= maxWarnings;
    if (limitReached) {
      assert warnings.length == maxWarnings;
    }
    var warnMap = Warning.fromArrayToMap(warnings, HashMapInsertNodeGen.getUncached());
    return new WithWarnings(value, maxWarnings, limitReached, warnMap);
  }

  private static boolean isAcceptableValue(Object value) {
    assert value != null;
    assert !(value instanceof WithWarnings) : "Trying to double wrap WithWarnings " + value;
    boolean goodValue =
        value instanceof TruffleObject
            || value instanceof Long
            || value instanceof Double
            || value instanceof Boolean;
    assert goodValue : "Unexpected value floating around " + value + " type: " + value.getClass();
    return goodValue;
  }

  public Object getValue() {
    return value;
  }

  // Ignore the warnings cache in .value and re-fetch them using the WarningsLibrary.
  // This is only used for shouldWrap=true.
  private Warning[] getWarningsNoCache(
      WarningsLibrary warningsLibrary, ArrayLikeLengthNode lengthNode, ArrayLikeAtNode atNode) {
    assert warningsLibrary != null;
    if (warningsLibrary.hasWarnings(value)) {
      try {
        return warningsLibrary.getWarnings(value, null, true);
      } catch (UnsupportedMessageException e) {
        throw EnsoContext.get(warningsLibrary).raiseAssertionPanic(warningsLibrary, null, e);
      }
    } else {
      return Warning.fromMapToArray(warnings, lengthNode, atNode);
    }
  }

  /**
   * Slow version of {@link #getWarningsArray(boolean, WarningsLibrary, HashMapInsertNode,
   * InteropLibrary, ArrayLikeLengthNode, ArrayLikeAtNode)} that uses uncached version of nodes and
   * libraries parameters.
   */
  public Warning[] getWarningsArray(boolean shouldWrap) {
    return getWarningsArray(
        shouldWrap,
        WarningsLibrary.getUncached(),
        HashMapInsertNodeGen.getUncached(),
        InteropLibrary.getUncached(),
        ArrayLikeLengthNodeGen.getUncached(),
        ArrayLikeAtNodeGen.getUncached());
  }

  public Warning[] getWarningsArray(
      boolean shouldWrap,
      WarningsLibrary warningsLibrary,
      HashMapInsertNode insertNode,
      InteropLibrary interop,
      ArrayLikeLengthNode lengthNode,
      ArrayLikeAtNode atNode) {
    Warning[] allWarnings;
    if (warningsLibrary != null && warningsLibrary.hasWarnings(value)) {
      try {
        var valueWarnings = warningsLibrary.getWarnings(value, null, shouldWrap);
        var tmp = cloneSetAndAppend(maxWarnings, warnings, valueWarnings, insertNode, interop);
        allWarnings = Warning.fromMapToArray(tmp, lengthNode, atNode);
      } catch (UnsupportedMessageException e) {
        throw EnsoContext.get(warningsLibrary).raiseAssertionPanic(warningsLibrary, null, e);
      }
    } else {
      allWarnings = Warning.fromMapToArray(warnings, lengthNode, atNode);
    }
    return allWarnings;
  }

  public ArrayRope<Warning> getReassignedWarningsAsRope(Node location, boolean shouldWrap) {
    return new ArrayRope<>(
        getReassignedWarnings(
            location,
            shouldWrap,
            null,
            HashMapInsertNodeGen.getUncached(),
            InteropLibrary.getUncached(),
            ArrayLikeLengthNodeGen.getUncached(),
            ArrayLikeAtNodeGen.getUncached()));
  }

  public Warning[] getReassignedWarnings(
      Node location,
      boolean shouldWrap,
      WarningsLibrary warningsLibrary,
      HashMapInsertNode insertNode,
      InteropLibrary interop,
      ArrayLikeLengthNode lengthNode,
      ArrayLikeAtNode atNode) {
    Warning[] warnings =
        getWarningsArray(shouldWrap, warningsLibrary, insertNode, interop, lengthNode, atNode);
    for (int i = 0; i < warnings.length; i++) {
      warnings[i] = warnings[i].reassign(location);
    }
    return warnings;
  }

  @CompilerDirectives.TruffleBoundary
  private PanicException asException(Node where) {
    var rawWarn =
        this.getWarnings(
            where,
            false,
            WarningsLibrary.getUncached(),
            HashMapInsertNodeGen.getUncached(),
            InteropLibrary.getUncached(),
            ArrayLikeAtNodeGen.getUncached(),
            ArrayLikeLengthNodeGen.getUncached());
    var ctx = EnsoContext.get(where);
    var scopeOfAny = ctx.getBuiltins().any().getDefinitionScope();
    var toText = UnresolvedSymbol.build("to_text", scopeOfAny);
    var node = InteropMethodCallNode.getUncached();
    var state = State.create(ctx);

    var text = Text.empty();
    for (var w : rawWarn) {
      try {
        var wText = node.execute(toText, state, new Object[] {w});
        if (wText instanceof Text t) {
          text = text.add(t);
        }
      } catch (ArityException e) {
        throw ctx.raiseAssertionPanic(where, null, e);
      }
    }
    return new PanicException(text, where);
  }

  @ExportMessage
  Object send(Message message, Object[] args, @CachedLibrary(limit = "3") ReflectionLibrary lib)
      throws Exception {
    return lib.send(value, message, args);
  }

  @ExportMessage
  boolean hasWarnings() {
    return true;
  }

  @ExportMessage
  Warning[] getWarnings(
      Node location,
      boolean shouldWrap,
      @Shared("warnsLib") @CachedLibrary(limit = "3") WarningsLibrary warningsLibrary,
      @Cached HashMapInsertNode insertNode,
      @CachedLibrary(limit = "3") InteropLibrary interop,
      @Cached ArrayLikeAtNode atNode,
      @Cached ArrayLikeLengthNode lengthNode) {
    if (location != null) {
      return getReassignedWarnings(
          location, shouldWrap, warningsLibrary, insertNode, interop, lengthNode, atNode);
    } else {
      if (shouldWrap) {
        // In the wrapping case, we don't use the local cache in .values, since
        // it contains unwrapped warnings. Instead, we fetch them again.
        return getWarningsNoCache(warningsLibrary, lengthNode, atNode);
      } else {
        return Warning.fromMapToArray(warnings, lengthNode, atNode);
      }
    }
  }

  @ExportMessage
  Object removeWarnings(@Shared("warnsLib") @CachedLibrary(limit = "3") WarningsLibrary warnings)
      throws UnsupportedMessageException {
    if (warnings.hasWarnings(value)) {
      return warnings.removeWarnings(value);
    } else {
      return value;
    }
  }

  @ExportMessage
  public boolean isLimitReached() {
    return limitReached;
  }

  @ExportMessage
  boolean hasType(@Shared("typesLib") @CachedLibrary(limit = "3") TypesLibrary types) {
    return types.hasType(value);
  }

  @ExportMessage
  Type getType(@Shared("typesLib") @CachedLibrary(limit = "3") TypesLibrary types) {
    return types.getType(value);
  }

  @ExportMessage
  boolean hasSpecialDispatch() {
    return true;
  }

  @ExportMessage
  boolean isException() {
    return true;
  }

  @ExportMessage
  RuntimeException throwException(@Bind("$node") Node node) {
    throw asException(node);
  }

  private EnsoHashMap cloneSetAndAppend(
      int maxWarnings,
      EnsoHashMap initial,
      Warning[] entries,
      HashMapInsertNode insertNode,
      InteropLibrary interop) {
    if (initial.getHashSize() == maxWarnings) {
      return initial;
    }
    var set = EnsoHashMap.empty();
    var initialVec = initial.getCachedVectorRepresentation();
    try {
      for (int i = 0; i < interop.getArraySize(initialVec); i++) {
        if (set.getHashSize() == maxWarnings) {
          return set;
        }
        var entry = interop.readArrayElement(initialVec, i);
        assert interop.getArraySize(entry) == 2;
        var key = interop.readArrayElement(entry, 0);
        var value = interop.readArrayElement(entry, 1);
        set = insertNode.execute(null, set, key, value);
      }
    } catch (UnsupportedMessageException | InvalidArrayIndexException e) {
      throw CompilerDirectives.shouldNotReachHere(e);
    }
    for (Warning warn : entries) {
      if (set.getHashSize() == maxWarnings) {
        return set;
      }
      set = insertNode.execute(null, set, warn.getSequenceId(), warn);
    }
    return set;
  }

  @Override
  public String toString() {
    return "WithWarnings{"
        + value
        + " has "
        + warnings.getHashSize()
        + " warnings"
        + (limitReached ? " (warnings limit reached)}" : "}");
  }
}
