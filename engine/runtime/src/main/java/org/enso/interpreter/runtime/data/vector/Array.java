package org.enso.interpreter.runtime.data.vector;

import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.dsl.Bind;
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Cached.Shared;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.InvalidArrayIndexException;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.profiles.BranchProfile;
import java.util.Arrays;
import org.enso.interpreter.dsl.Builtin;
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.data.EnsoObject;
import org.enso.interpreter.runtime.data.Type;
import org.enso.interpreter.runtime.data.hash.EnsoHashMap;
import org.enso.interpreter.runtime.data.hash.HashMapInsertNode;
import org.enso.interpreter.runtime.library.dispatch.TypesLibrary;
import org.enso.interpreter.runtime.warning.HasWarningsNode;
import org.enso.interpreter.runtime.warning.Warning;
import org.enso.interpreter.runtime.warning.WarningsLibrary;
import org.enso.interpreter.runtime.warning.WithWarnings;

/** A primitive boxed array type for use in the runtime. */
@ExportLibrary(InteropLibrary.class)
@ExportLibrary(TypesLibrary.class)
@ExportLibrary(WarningsLibrary.class)
@Builtin(pkg = "mutable", stdlibName = "Standard.Base.Data.Array.Array")
final class Array implements EnsoObject {
  private final Object[] items;
  private Boolean withWarnings;
  private Warning[] cachedWarningsWrapped;
  private Warning[] cachedWarningsUnwrapped;

  /**
   * Creates a new array
   *
   * @param items the element values
   */
  private Array(Object... items) {
    this.items = items;
  }

  static Array wrap(Object... items) {
    assert noNulls(items);
    return new Array(items);
  }

  static Array allocate(long size) {
    var arr = new Object[Math.toIntExact(size)];
    return new Array(arr);
  }

  private static boolean noNulls(Object[] arr) {
    for (Object o : arr) {
      if (o == null) {
        return false;
      }
    }
    return true;
  }

  /**
   * @return the elements of this array as a java array.
   */
  final Object[] getItems() {
    return items;
  }

  /**
   * Marks the object as array-like for Polyglot APIs.
   *
   * @return {@code true}
   */
  @ExportMessage
  boolean hasArrayElements() {
    return true;
  }

  /**
   * Handles reading an element by index through the polyglot API.
   *
   * @param index the index to read
   * @return the element value at the provided index
   * @throws InvalidArrayIndexException when the index is out of bounds.
   */
  @ExportMessage
  Object readArrayElement(
      long index,
      @CachedLibrary(limit = "3") WarningsLibrary warnings,
      @Cached HasWarningsNode hasWarningsNode,
      @CachedLibrary(limit = "3") InteropLibrary interop,
      @Cached BranchProfile errProfile,
      @Cached BranchProfile hasWarningsProfile,
      @Cached HashMapInsertNode mapInsertNode)
      throws InvalidArrayIndexException, UnsupportedMessageException {
    if (index >= items.length || index < 0) {
      errProfile.enter();
      throw InvalidArrayIndexException.create(index);
    }

    var v = items[(int) index];
    if (hasWarningsNode.execute(warnings)) {
      hasWarningsProfile.enter();
      Warning[] extracted = this.getWarnings(null, false, warnings, mapInsertNode, hasWarningsNode);
      if (hasWarningsNode.execute(v)) {
        v = warnings.removeWarnings(v);
      }
      return WithWarnings.wrap(v, EnsoContext.get(warnings), mapInsertNode, interop, extracted);
    }

    return v;
  }

  long length() {
    return items.length;
  }

  /**
   * Exposes the size of this collection through the polyglot API.
   *
   * @return the size of this array
   */
  @ExportMessage
  long getArraySize() {
    return items.length;
  }

  /**
   * Exposes an index validity check through the polyglot API.
   *
   * @param index the index to check
   * @return {@code true} if the index is valid, {@code false} otherwise.
   */
  @ExportMessage
  boolean isArrayElementReadable(long index) {
    return index < getArraySize() && index >= 0;
  }

  @ExportMessage
  String toDisplayString(boolean b) {
    return toString();
  }

  @ExportMessage
  Type getMetaObject(@Bind("$node") Node node) {
    return EnsoContext.get(node).getBuiltins().array();
  }

  @ExportMessage
  boolean hasMetaObject() {
    return true;
  }

  @Override
  @CompilerDirectives.TruffleBoundary
  public String toString() {
    return Arrays.toString(items);
  }

  @ExportMessage
  boolean hasType() {
    return true;
  }

  private boolean hasWarningElements(
      Object[] items, WarningsLibrary warnings, HasWarningsNode hasWarningsNode) {
    for (Object item : items) {
      if (hasWarningsNode.execute(item)) {
        return true;
      }
    }
    return false;
  }

  @ExportMessage
  Warning[] getWarnings(
      Node location,
      boolean shouldWrap,
      @Shared("warnsLib") @CachedLibrary(limit = "3") WarningsLibrary warnings,
      @Shared("mapInsertNode") @Cached HashMapInsertNode mapInsertNode,
      @Shared @Cached HasWarningsNode hasWarningsNode)
      throws UnsupportedMessageException {
    Warning[] cache = shouldWrap ? cachedWarningsWrapped : cachedWarningsUnwrapped;
    if (cache == null) {
      cache =
          Warning.fromSetToArray(
              collectAllWarnings(warnings, location, mapInsertNode, hasWarningsNode, shouldWrap));
      if (shouldWrap) {
        cachedWarningsWrapped = cache;
      } else {
        cachedWarningsUnwrapped = cache;
      }
    }
    return cache;
  }

  @CompilerDirectives.TruffleBoundary
  private EnsoHashMap collectAllWarnings(
      WarningsLibrary warningsLib,
      Node location,
      HashMapInsertNode mapInsertNode,
      HasWarningsNode hasWarningsNode,
      boolean shouldWrap)
      throws UnsupportedMessageException {
    var warnsSet = EnsoHashMap.empty();
    for (int i = 0; i < this.items.length; i++) {
      final int finalIndex = i;
      Object item = this.items[i];
      if (hasWarningsNode.execute(item)) {
        Warning[] warnings = warningsLib.getWarnings(item, location, shouldWrap);
        Warning[] wrappedWarningsMaybe;

        if (shouldWrap) {
          wrappedWarningsMaybe =
              Arrays.stream(warnings)
                  .map(warning -> Warning.wrapMapError(warningsLib, warning, finalIndex))
                  .toArray(Warning[]::new);
        } else {
          wrappedWarningsMaybe = warnings;
        }

        for (var warn : wrappedWarningsMaybe) {
          warnsSet = mapInsertNode.execute(null, warnsSet, warn, null);
        }
      }
    }
    return warnsSet;
  }

  @ExportMessage
  Array removeWarnings(
      @Shared("warnsLib") @CachedLibrary(limit = "3") WarningsLibrary warnings,
      @Shared @Cached HasWarningsNode hasWarningsNode)
      throws UnsupportedMessageException {
    Object[] items = new Object[this.items.length];
    for (int i = 0; i < this.items.length; i++) {
      if (hasWarningsNode.execute(this.items[i])) {
        items[i] = warnings.removeWarnings(this.items[i]);
      } else {
        items[i] = this.items[i];
      }
    }
    return new Array(items);
  }

  @ExportMessage
  boolean isLimitReached(
      @Shared("warnsLib") @CachedLibrary(limit = "3") WarningsLibrary warnings,
      @Shared("mapInsertNode") @Cached HashMapInsertNode mapInsertNode,
      @Shared @Cached HasWarningsNode hasWarningsNode) {
    try {
      int limit = EnsoContext.get(warnings).getWarningsLimit();
      return getWarnings(null, false, warnings, mapInsertNode, hasWarningsNode).length >= limit;
    } catch (UnsupportedMessageException e) {
      return false;
    }
  }

  @ExportMessage
  Type getType(@Bind("$node") Node node) {
    return EnsoContext.get(node).getBuiltins().array();
  }
}
