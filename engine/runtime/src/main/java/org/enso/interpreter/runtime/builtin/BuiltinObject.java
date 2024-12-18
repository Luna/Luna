package org.enso.interpreter.runtime.builtin;

import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.CompilerDirectives.TruffleBoundary;
import com.oracle.truffle.api.Truffle;
import com.oracle.truffle.api.dsl.Bind;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import com.oracle.truffle.api.nodes.Node;
import java.lang.System;
import java.util.ArrayList;
import java.util.List;
import org.enso.interpreter.node.expression.builtin.Builtin;
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.data.EnsoObject;
import org.enso.interpreter.runtime.data.Type;
import org.enso.interpreter.runtime.data.text.Text;
import org.enso.interpreter.runtime.error.PanicException;
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

  private BuiltinWithContext cachedBuiltinType;

  protected BuiltinObject() {}

  @ExportMessage
  public final boolean hasType() {
    return true;
  }

  private static List<String> truffleStack() {
    var stack = new ArrayList<String>();
    Truffle.getRuntime().iterateFrames((frameInstance) -> {
      var callNode = frameInstance.getCallNode();
      if (callNode != null) {
        var rootNode = callNode.getRootNode();
        if (rootNode != null) {
          var fqn = rootNode.getQualifiedName();
          stack.add(fqn);
        }
      }
      return null;
    });
    return stack;
  }

  @ExportMessage
  @TruffleBoundary
  public final Type getType(@Bind("$node") Node node) {
    if (cachedBuiltinType == null) {
      CompilerDirectives.transferToInterpreterAndInvalidate();
      var ctx = EnsoContext.get(node);
      cachedBuiltinType = new BuiltinWithContext(
          ctx.getBuiltins().getBuiltinType(builtinName),
          ctx,
          new RuntimeException(),
          truffleStack());
    } else {
      assert assertCorrectCachedBuiltin(node);
    }
    return cachedBuiltinType.builtin.getType();
  }

  private boolean assertCorrectCachedBuiltin(Node node) {
    assert cachedBuiltinType != null;
    var curCtx = EnsoContext.get(node);
    var curBuiltinType = curCtx.getBuiltins().getBuiltinType(builtinName);
    var prevCtx = cachedBuiltinType.ctx;
    var errMsgSb = new StringBuilder();
    if (curCtx != prevCtx) {
      errMsgSb.append("Context mismatch: ")
          .append("previous context: ")
          .append(hex(prevCtx))
          .append(", current context: ")
          .append(hex(curCtx))
          .append(System.lineSeparator());
    }
    var prevBuiltinType = cachedBuiltinType.builtin;
    if (curBuiltinType != prevBuiltinType) {
      errMsgSb.append("Builtin type '")
          .append(curBuiltinType.getType().getQualifiedName())
          .append("' mismatch: ")
          .append("previous builtin type: ")
          .append(hex(prevBuiltinType))
          .append(", current builtin type: ")
          .append(hex(curBuiltinType))
          .append(System.lineSeparator());
    }
    if (errMsgSb.isEmpty()) {
      return true;
    } else {
      // Print stack trace of when the builtin type was cached
      System.out.println("Truffle stack of cached builtin type: ");
      cachedBuiltinType.truffleStack.forEach(
          (frame) -> System.out.println("  " + frame));
      System.out.println();
      System.out.println("RuntimeException stack of cached builtin type: ");
      cachedBuiltinType.ex.printStackTrace(System.out);
      throw new AssertionError(errMsgSb.toString());
    }
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

  private static final String hex(Object obj) {
    return Integer.toHexString(System.identityHashCode(obj));
  }

  private record BuiltinWithContext(Builtin builtin, EnsoContext ctx, RuntimeException ex, List<String> truffleStack) {}
}
