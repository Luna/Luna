package org.enso.interpreter.runtime.data.vector;

import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.InvalidArrayIndexException;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import org.enso.interpreter.dsl.Builtin;
import org.enso.interpreter.node.expression.builtin.BuiltinObject;
import org.enso.interpreter.node.expression.foreign.HostValueToEnsoNode;
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.data.hash.EnsoHashMap;
import org.enso.interpreter.runtime.warning.AppendWarningNode;
import org.enso.interpreter.runtime.warning.WarningsLibrary;

@ExportLibrary(InteropLibrary.class)
@Builtin(pkg = "immutable", stdlibName = "Standard.Base.Data.Vector.Vector")
abstract class Vector extends BuiltinObject {
  private static final Vector EMPTY_LONG = new Long(new long[0]);
  private static final Vector EMPTY_DOUBLE = new Double(new double[0]);
  private static final Vector EMPTY_VECTOR = new EnsoOnly(new Object[0]);

  protected Vector() {
    super("Vector");
  }

  @ExportMessage
  boolean hasArrayElements() {
    return true;
  }

  @ExportMessage
  boolean isArrayElementModifiable(long index) {
    return false;
  }

  @ExportMessage
  boolean isArrayElementReadable(long index) {
    return true;
  }

  @ExportMessage
  abstract long getArraySize() throws UnsupportedMessageException;

  @ExportMessage
  abstract Object readArrayElement(long index)
      throws UnsupportedMessageException, InvalidArrayIndexException;

  @ExportMessage
  final void writeArrayElement(long index, Object value) throws UnsupportedMessageException {
    throw UnsupportedMessageException.create();
  }

  @ExportMessage
  boolean isArrayElementInsertable(long index) {
    return false;
  }

  @ExportMessage
  boolean isArrayElementRemovable(long index) {
    return false;
  }

  @ExportMessage
  final void removeArrayElement(long index) throws UnsupportedMessageException {
    throw UnsupportedMessageException.create();
  }

  @ExportMessage
  @CompilerDirectives.TruffleBoundary
  @Override
  public String toDisplayString(boolean allowSideEffects) {
    final InteropLibrary iop = InteropLibrary.getUncached();
    return DisplayArrayUtils.toDisplayString(this, allowSideEffects, iop);
  }

  //
  // helper methods
  //

  @Override
  @CompilerDirectives.TruffleBoundary
  public String toString() {
    return toDisplayString(false);
  }

  static Vector fromInteropArray(Object arr) {
    return new Generic(arr);
  }

  static Vector fromLongArray(long[] arr) {
    if (arr == null || arr.length == 0) {
      return EMPTY_LONG;
    } else {
      return new Long(arr);
    }
  }

  static Vector fromDoubleArray(double[] arr) {
    if (arr == null || arr.length == 0) {
      return EMPTY_DOUBLE;
    } else {
      return new Double(arr);
    }
  }

  static Vector fromEnsoOnlyArray(Object[] arr) {
    if (arr == null || arr.length == 0) {
      return EMPTY_VECTOR;
    } else {
      return new EnsoOnly(arr);
    }
  }

  @ExportLibrary(InteropLibrary.class)
  @ExportLibrary(WarningsLibrary.class)
  static final class EnsoOnly extends Vector {
    private final Object[] storage;

    private EnsoOnly(Object[] storage) {
      this.storage = storage;
    }

    //
    // messages for the InteropLibrary
    //

    @ExportMessage
    long getArraySize() {
      return storage.length;
    }

    @ExportMessage
    Object readArrayElement(long index) throws InvalidArrayIndexException {
      try {
        return storage[Math.toIntExact(index)];
      } catch (ArithmeticException | IndexOutOfBoundsException ex) {
        throw InvalidArrayIndexException.create(index);
      }
    }

    @ExportMessage
    boolean isArrayElementReadable(long index) {
      var size = storage.length;
      return index < size && index >= 0;
    }

    @ExportMessage
    boolean hasWarnings() {
      return false;
    }

    @ExportMessage
    EnsoHashMap getWarnings(boolean shouldWrap) {
      return EnsoHashMap.empty();
    }

    @ExportMessage
    EnsoOnly removeWarnings() throws UnsupportedMessageException {
      return this;
    }

    @ExportMessage
    boolean isLimitReached() {
      return false;
    }
  }

  @ExportLibrary(InteropLibrary.class)
  @ExportLibrary(WarningsLibrary.class)
  static final class Generic extends Vector {
    private final Object storage;

    private Generic(Object storage) {
      if (CompilerDirectives.inInterpreter()) {
        if (!InteropLibrary.getUncached().hasArrayElements(storage)) {
          throw EnsoContext.get(null)
              .raiseAssertionPanic(
                  null, "Vector needs array-like delegate, but got: " + storage, null);
        }
      }
      this.storage = storage;
    }

    final Object toArray() {
      return this.storage;
    }

    //
    // messages for the InteropLibrary
    //

    @ExportMessage
    long getArraySize(
        @Cached.Shared(value = "interop") @CachedLibrary(limit = "3") InteropLibrary interop)
        throws UnsupportedMessageException {
      return interop.getArraySize(storage);
    }

    @ExportMessage.Ignore
    @Override
    Object readArrayElement(long index)
        throws UnsupportedMessageException, InvalidArrayIndexException {
      throw new AbstractMethodError();
    }

    @ExportMessage.Ignore
    @Override
    long getArraySize() throws UnsupportedMessageException {
      throw new AbstractMethodError();
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
        @Cached.Shared(value = "interop") @CachedLibrary(limit = "3") InteropLibrary interop,
        @CachedLibrary(limit = "3") WarningsLibrary warnings,
        @Cached HostValueToEnsoNode toEnso,
        @Cached AppendWarningNode appendWarningNode)
        throws InvalidArrayIndexException, UnsupportedMessageException {
      var v = interop.readArrayElement(this.storage, index);
      if (warnings.hasWarnings(this.storage)) {
        var extracted = warnings.getWarnings(this.storage, false);
        if (warnings.hasWarnings(v)) {
          v = warnings.removeWarnings(v);
        }
        return appendWarningNode.executeAppend(null, toEnso.execute(v), extracted);
      }
      return toEnso.execute(v);
    }

    /**
     * Exposes an index validity check through the polyglot API.
     *
     * @param index the index to check
     * @return {@code true} if the index is valid, {@code false} otherwise.
     */
    @ExportMessage
    boolean isArrayElementReadable(
        long index,
        @Cached.Shared(value = "interop") @CachedLibrary(limit = "3") InteropLibrary interop) {
      try {
        var size = interop.getArraySize(storage);
        return index < size && index >= 0;
      } catch (UnsupportedMessageException e) {
        return false;
      }
    }

    @ExportMessage
    boolean hasWarnings(
        @Cached.Shared(value = "warnsLib") @CachedLibrary(limit = "3") WarningsLibrary warnings) {
      return warnings.hasWarnings(this.storage);
    }

    @ExportMessage
    EnsoHashMap getWarnings(
        boolean shouldWrap,
        @Cached.Shared(value = "warnsLib") @CachedLibrary(limit = "3") WarningsLibrary warnings)
        throws UnsupportedMessageException {
      return warnings.getWarnings(this.storage, shouldWrap);
    }

    @ExportMessage
    Generic removeWarnings(
        @Cached.Shared(value = "warnsLib") @CachedLibrary(limit = "3") WarningsLibrary warnings)
        throws UnsupportedMessageException {
      return new Generic(warnings.removeWarnings(this.storage));
    }

    @ExportMessage
    boolean isLimitReached(
        @Cached.Shared(value = "warnsLib") @CachedLibrary(limit = "3") WarningsLibrary warnings) {
      return warnings.isLimitReached(this.storage);
    }
  }

  @ExportLibrary(value = InteropLibrary.class)
  @ExportLibrary(value = WarningsLibrary.class)
  static final class Double extends Vector {
    private final double[] storage;

    private Double(double[] storage) {
      this.storage = storage;
    }

    @ExportMessage
    long getArraySize() {
      return storage.length;
    }

    /**
     * Handles reading an element by index through the polyglot API.
     *
     * @param index the index to read
     * @return the element value at the provided index
     * @throws InvalidArrayIndexException when the index is out of bounds.
     */
    @ExportMessage
    Object readArrayElement(long index) throws InvalidArrayIndexException {
      try {
        return storage[Math.toIntExact(index)];
      } catch (ArithmeticException | IndexOutOfBoundsException ex) {
        throw InvalidArrayIndexException.create(index);
      }
    }

    /**
     * Exposes an index validity check through the polyglot API.
     *
     * @param index the index to check
     * @return {@code true} if the index is valid, {@code false} otherwise.
     */
    @ExportMessage
    boolean isArrayElementReadable(long index) {
      var size = storage.length;
      return index < size && index >= 0;
    }

    @ExportMessage
    boolean hasWarnings() {
      return false;
    }

    @ExportMessage
    EnsoHashMap getWarnings(boolean shouldWrap) {
      return EnsoHashMap.empty();
    }

    @ExportMessage
    Double removeWarnings() {
      return this;
    }

    @ExportMessage
    boolean isLimitReached() {
      return false;
    }
  }

  @ExportLibrary(value = InteropLibrary.class)
  @ExportLibrary(value = WarningsLibrary.class)
  static final class Long extends Vector {
    private final long[] storage;

    private Long(long[] storage) {
      this.storage = storage;
    }

    @ExportMessage
    long getArraySize() {
      return storage.length;
    }

    @ExportMessage
    Object readArrayElement(long index) throws InvalidArrayIndexException {
      try {
        return storage[Math.toIntExact(index)];
      } catch (ArithmeticException | IndexOutOfBoundsException ex) {
        throw InvalidArrayIndexException.create(index);
      }
    }

    @ExportMessage
    boolean isArrayElementReadable(long index) {
      var size = storage.length;
      return index < size && index >= 0;
    }

    @ExportMessage
    boolean hasWarnings() {
      return false;
    }

    @ExportMessage
    EnsoHashMap getWarnings(boolean shouldWrap) {
      return EnsoHashMap.empty();
    }

    @ExportMessage
    Long removeWarnings() {
      return this;
    }

    @ExportMessage
    boolean isLimitReached() {
      return false;
    }
  }
}
