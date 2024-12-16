package org.enso.interpreter.runtime.builtin;

import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.CompilerDirectives.CompilationFinal;
import com.oracle.truffle.api.dsl.Bind;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import com.oracle.truffle.api.nodes.Node;
import java.lang.ref.WeakReference;
import org.enso.interpreter.node.expression.builtin.Builtin;
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.data.EnsoObject;
import org.enso.interpreter.runtime.data.Type;
import org.enso.interpreter.runtime.library.dispatch.TypesLibrary;

/**
 * Base class for every Enso builtin object. Not type. Note that base class for a builtin type is
 * {@link Builtin}.
 *
 * <p>In other words, this class represents an object of builtin type in a similar way that {@link
 * org.enso.interpreter.runtime.data.atom.Atom} represents an object of a non-builtin type.
 */
@ExportLibrary(InteropLibrary.class)
@ExportLibrary(TypesLibrary.class)
public abstract class BuiltinObject extends EnsoObject {

  private final String builtinName;

  /**
   * A weak reference to the context in which this node was last executed.
   *
   * <p>Inspired by {@link
   * org.enso.interpreter.node.expression.builtin.meta.EnsoProjectNode#previousCtxRef}
   */
  @CompilationFinal private WeakReference<EnsoContext> previousCtxRef = new WeakReference<>(null);

  private Builtin cachedBuiltinType;

  /**
   * @param builtinName Simple name of the builtin that should be contained in {@link
   *     org.enso.interpreter.runtime.builtin.Builtins#builtinsByName}.
   */
  protected BuiltinObject(String builtinName) {
    this.builtinName = builtinName;
  }

  @ExportMessage
  public final boolean hasType() {
    return true;
  }

  @ExportMessage
  public final Type getType(@Bind("$node") Node node) {
    var ctx = EnsoContext.get(node);
    var previousCtx = previousCtxRef.get();
    if (previousCtx == null || cachedBuiltinType == null || previousCtx != ctx) {
      CompilerDirectives.transferToInterpreterAndInvalidate();
      previousCtxRef = new WeakReference<>(ctx);
      cachedBuiltinType = ctx.getBuiltins().getBuiltinType(builtinName);
    }
    return cachedBuiltinType.getType();
  }

  /**
   * Must return false, otherwise if a builtin object is passed to a host method that has a single
   * {@code Object} argument, host interop would convert the builtin object to a {@code Map} with
   * all its members. Even if the builtin object is, e.g., a number of a date.
   *
   * <p>Must return false as long as all our stdlib Java methods accept {@code Object} and not
   * {@link org.graalvm.polyglot.Value} as arguments comming from Enso.
   */
  @ExportMessage
  public final boolean hasMembers() {
    return false;
  }

  @ExportMessage
  public final Object getMembers(boolean includeInternal) throws UnsupportedMessageException {
    throw UnsupportedMessageException.create();
  }

  @ExportMessage
  public final boolean hasMetaObject() {
    return true;
  }

  @ExportMessage
  public final Type getMetaObject(@Bind("$node") Node node) {
    return getType(node);
  }
}
