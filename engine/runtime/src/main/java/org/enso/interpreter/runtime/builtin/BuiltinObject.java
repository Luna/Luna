package org.enso.interpreter.runtime.builtin;

import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.CompilerDirectives.TruffleBoundary;
import com.oracle.truffle.api.dsl.Bind;
import com.oracle.truffle.api.interop.ArityException;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.UnknownIdentifierException;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.interop.UnsupportedTypeException;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import com.oracle.truffle.api.nodes.Node;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.enso.interpreter.node.expression.builtin.Builtin;
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.callable.UnresolvedSymbol;
import org.enso.interpreter.runtime.callable.function.Function;
import org.enso.interpreter.runtime.data.EnsoObject;
import org.enso.interpreter.runtime.data.Type;
import org.enso.interpreter.runtime.data.vector.ArrayLikeHelpers;
import org.enso.interpreter.runtime.library.dispatch.TypesLibrary;

/**
 * Base class for every Enso builtin object. Not type. Note that base class for a builtin type is
 * {@link Builtin}.
 *
 * <p>The {@link InteropLibrary interop} protocol roughly corresponds to the implementation of the
 * protocol inside {@link org.enso.interpreter.runtime.data.atom.Atom}.
 *
 * <p>Note that extension methods are not resolved, because they are not defined in builtins module
 * scope. In other words, extension methods are not reported as members via interop.
 */
@ExportLibrary(InteropLibrary.class)
@ExportLibrary(TypesLibrary.class)
public abstract class BuiltinObject extends EnsoObject {

  private final String builtinName;
  private Map<String, Function> methods;
  private Builtin cachedBuiltinType;

  /**
   * @param builtinName Simple name of the builtin that should be contained in {@link
   *     org.enso.interpreter.runtime.builtin.Builtins#builtinsByName}.
   */
  protected BuiltinObject(String builtinName) {
    this.builtinName = builtinName;
  }

  @ExportMessage
  public final boolean hasMembers() {
    return true;
  }

  @ExportMessage
  @TruffleBoundary
  public final Object getMembers(boolean includeInternal, @Bind("$node") Node node) {
    var methodNamesArr = methodNames().toArray(String[]::new);
    return ArrayLikeHelpers.wrapStrings(methodNamesArr);
  }

  @ExportMessage
  @TruffleBoundary
  public final boolean isMemberReadable(String member) {
    return methodNames().contains(member);
  }

  @ExportMessage
  @TruffleBoundary
  public final boolean isMemberInvocable(String member) {
    return isMemberReadable(member);
  }

  @ExportMessage
  @TruffleBoundary
  public final Object readMember(String member) throws UnknownIdentifierException {
    if (!isMemberReadable(member)) {
      throw UnknownIdentifierException.create(member);
    }
    var func = methods().get(member);
    if (func != null) {
      return func;
    }
    throw UnknownIdentifierException.create(member);
  }

  @ExportMessage
  @TruffleBoundary
  public final Object invokeMember(String member, Object[] args)
      throws UnsupportedMessageException, UnsupportedTypeException, ArityException {
    var ctx = EnsoContext.get(null);
    var sym = UnresolvedSymbol.build(member, ctx.getBuiltins().getScope());
    var argsForBuiltin = new Object[args.length + 1];
    argsForBuiltin[0] = this;
    java.lang.System.arraycopy(args, 0, argsForBuiltin, 1, args.length);
    var interop = InteropLibrary.getUncached();
    return interop.execute(sym, argsForBuiltin);
  }

  @ExportMessage
  public final boolean hasType() {
    return true;
  }

  @ExportMessage
  public final Type getType(@Bind("$node") Node node) {
    if (cachedBuiltinType == null) {
      CompilerDirectives.transferToInterpreter();
      var ctx = EnsoContext.get(node);
      cachedBuiltinType = ctx.getBuiltins().getBuiltinType(builtinName);
    }
    return cachedBuiltinType.getType();
  }

  @ExportMessage
  public final boolean hasMetaObject() {
    return true;
  }

  @ExportMessage
  public final Type getMetaObject(@Bind("$node") Node node) {
    return getType(node);
  }

  private Map<String, Function> methods() {
    var ctx = EnsoContext.get(null);
    if (methods == null) {
      var builtinType = ctx.getBuiltins().getBuiltinType(builtinName);
      assert builtinType != null;
      var defScope = builtinType.getType().getDefinitionScope();
      var methodsFromScope = defScope.getMethodsForType(builtinType.getType());
      assert methodsFromScope != null;
      methods = new HashMap<>();
      for (var method : methodsFromScope) {
        var methodName = normalizeName(method.getName());
        methods.put(methodName, method);
      }
    }
    return methods;
  }

  private Set<String> methodNames() {
    var methodNames =
        methods().keySet().stream()
            .map(BuiltinObject::normalizeName)
            .collect(Collectors.toUnmodifiableSet());
    return methodNames;
  }

  private static String normalizeName(String funcName) {
    var funcNameItems = funcName.split("\\.");
    return funcNameItems[funcNameItems.length - 1];
  }
}
