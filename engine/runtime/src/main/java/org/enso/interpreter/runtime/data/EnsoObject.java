package org.enso.interpreter.runtime.data;

import com.oracle.truffle.api.CompilerDirectives.TruffleBoundary;
import com.oracle.truffle.api.TruffleLanguage;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.TruffleObject;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import org.enso.interpreter.EnsoLanguage;

/** All non-primitive Enso types extends from {@code EnsoObject}. */
@ExportLibrary(InteropLibrary.class)
public abstract class EnsoObject implements TruffleObject {
  @ExportMessage
  public boolean hasLanguage() {
    return true;
  }

  @ExportMessage
  public Class<? extends TruffleLanguage<?>> getLanguage() {
    return EnsoLanguage.class;
  }

  @ExportMessage
  @TruffleBoundary
  public Object toDisplayString(boolean allowSideEffects) {
    // Not implemented on purpose - should be implemented by subclasses.
    throw new AssertionError("unimplemented");
  }
}
