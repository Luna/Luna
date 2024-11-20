package org.enso.interpreter.runtime.data;

import com.oracle.truffle.api.CompilerDirectives.TruffleBoundary;
import com.oracle.truffle.api.dsl.Bind;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import com.oracle.truffle.api.nodes.Node;
import java.lang.ref.Reference;
import java.lang.ref.SoftReference;
import java.lang.ref.WeakReference;
import org.enso.interpreter.dsl.Builtin;
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.library.dispatch.TypesLibrary;

/** A mutable reference type. */
@ExportLibrary(InteropLibrary.class)
@ExportLibrary(TypesLibrary.class)
@Builtin(pkg = "mutable", stdlibName = "Standard.Base.Runtime.Ref.Ref")
public final class Ref extends EnsoObject {
  /**
   * {@code 0} - regular reference to an object {@code 1} - reference via {@link SoftReference}
   * {@code 2} - reference via {@link WeakReference}
   */
  private final byte type;

  private volatile Object value;

  /**
   * Creates a new reference.
   *
   * @param value the initial value to store in the reference.
   * @param referenceType type of reference to use
   */
  @Builtin.Method(description = "Creates a new Ref", autoRegister = false)
  public Ref(Object value, long referenceType) {
    this.type = (byte) (referenceType & 0x03);
    this.value = wrapValue(value);
  }

  /**
   * @return the current value of the reference.
   */
  @Builtin.Method(name = "get", description = "Gets the value stored in the reference")
  @SuppressWarnings("generic-enso-builtin-type")
  public Object getValue() {
    return unwrapValue(value);
  }

  /**
   * Stores a new value in the reference.
   *
   * @param value the value to store.
   * @returns the original value
   */
  @Builtin.Method(name = "put", description = "Stores a new value in the reference")
  @SuppressWarnings("generic-enso-builtin-type")
  public Object setValue(Object value) {
    Object old = this.value;
    this.value = wrapValue(value);
    return unwrapValue(old);
  }

  @ExportMessage
  Type getMetaObject(@Bind("$node") Node node) {
    return EnsoContext.get(node).getBuiltins().ref();
  }

  @ExportMessage
  boolean hasMetaObject() {
    return true;
  }

  @ExportMessage
  boolean hasType() {
    return true;
  }

  @ExportMessage
  Type getType(@Bind("$node") Node node) {
    return EnsoContext.get(node).getBuiltins().ref();
  }

  private final Object wrapValue(Object v) {
    if (type == 0) {
      return v;
    }
    assert !(v instanceof Reference<?>) : "Ref[" + type + ", " + v + "]";
    var ctx = EnsoContext.get(null);
    return ctx.getReferencesManager().create(v, type);
  }

  private final Object unwrapValue(Object v) {
    if (v instanceof Reference<?> ref) {
      var ret = ref.get();
      return ret == null ? EnsoContext.get(null).getNothing() : ret;
    } else {
      return v;
    }
  }

  @ExportMessage
  Object toDisplayString(
      boolean allowSideEffects, @CachedLibrary(limit = "3") InteropLibrary interop) {
    return interop.toDisplayString(value, allowSideEffects);
  }

  @TruffleBoundary
  @Override
  @ExportMessage.Ignore
  public Object toDisplayString(boolean allowSideEffects) {
    return toDisplayString(allowSideEffects, InteropLibrary.getUncached());
  }
}
