package org.enso.interpreter.runtime.error;

import com.oracle.truffle.api.exception.AbstractTruffleException;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.nodes.Node;
import java.util.Objects;
import org.enso.interpreter.runtime.data.EnsoObject;
import org.enso.interpreter.runtime.library.dispatch.TypesLibrary;

/**
 * Base class for all exceptions (dataflow errors and panics) thrown within Enso. Just delegates all
 * the interop messages to the delegate field.
 */
@ExportLibrary(value = InteropLibrary.class, delegateTo = "delegate")
@ExportLibrary(value = TypesLibrary.class, delegateTo = "delegate")
class EnsoException extends AbstractTruffleException {
  final Object delegate;

  private EnsoException(Object delegate, Node location) {
    super(location);
    this.delegate = delegate;
  }

  static EnsoException fromEnsoObject(EnsoObject ensoObject, Node location) {
    Objects.requireNonNull(ensoObject);
    return new EnsoException(ensoObject, location);
  }

  static EnsoException fromPanicSentinel(PanicSentinel panicSentinel, Node location) {
    Objects.requireNonNull(panicSentinel);
    return new EnsoException(panicSentinel, location);
  }
}
