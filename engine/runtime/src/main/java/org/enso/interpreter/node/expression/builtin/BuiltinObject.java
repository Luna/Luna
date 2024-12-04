package org.enso.interpreter.node.expression.builtin;

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
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.callable.UnresolvedSymbol;
import org.enso.interpreter.runtime.callable.function.Function;
import org.enso.interpreter.runtime.data.EnsoObject;
import org.enso.interpreter.runtime.data.Type;
import org.enso.interpreter.runtime.data.vector.ArrayLikeHelpers;
import org.enso.interpreter.runtime.library.dispatch.TypesLibrary;

/**
 * Base class for every Enso builtin object. Not type. Note that base class for a builtin type is
 * {@link Builtin}. TODO: BuiltinTypeProcessor should ensure that all the builtin types are
 * subclasses of BuiltinObject.
 *
 * <p>The {@link InteropLibrary interop} protocol corresponds to the implementation of the protocol
 * inside {@link org.enso.interpreter.runtime.data.atom.Atom}.
 */
@ExportLibrary(InteropLibrary.class)
@ExportLibrary(TypesLibrary.class)
public abstract class BuiltinObject extends EnsoObject {

  private final String builtinName;
  private Map<String, Function> methods;

  protected BuiltinObject(String builtinName) {
    assert assertBuiltinDefined(builtinName);
    this.builtinName = builtinName;
  }

  @ExportMessage
  public boolean hasMembers() {
    return true;
  }

  @ExportMessage
  public Object getMembers(boolean includeInternal, @Bind("$node") Node node) {
    var ctx = EnsoContext.get(node);
    var methodNamesArr = methodNames(ctx).toArray(String[]::new);
    return ArrayLikeHelpers.wrapStrings(methodNamesArr);
  }

  @ExportMessage
  public boolean isMemberReadable(String member) {
    var ctx = EnsoContext.get(null);
    return methodNames(ctx).contains(member);
  }

  @ExportMessage
  public boolean isMemberInvocable(String member) {
    return isMemberReadable(member);
  }

  @ExportMessage
  public Object readMember(String member) throws UnknownIdentifierException {
    if (!isMemberReadable(member)) {
      throw UnknownIdentifierException.create(member);
    }
    var ctx = EnsoContext.get(null);
    var func = methods(ctx).get(member);
    if (func != null) {
      return func;
    }
    throw UnknownIdentifierException.create(member);
  }

  @ExportMessage
  public Object invokeMember(String member, Object[] args)
      throws UnsupportedMessageException, UnsupportedTypeException, ArityException {
    var ctx = EnsoContext.get(null);
    var func = methods(ctx).get(member);
    var sym = UnresolvedSymbol.build(member, ctx.getBuiltins().getScope());
    var argsForBuiltin = new Object[args.length + 1];
    argsForBuiltin[0] = this;
    System.arraycopy(args, 0, argsForBuiltin, 1, args.length);
    var interop = InteropLibrary.getUncached();
    return interop.execute(sym, argsForBuiltin);
  }

  @ExportMessage
  public boolean hasType() {
    return true;
  }

  @ExportMessage
  public Type getType() {
    var ctx = EnsoContext.get(null);
    return ctx.getBuiltins().getBuiltinType(builtinName).getType();
  }

  @ExportMessage
  public boolean hasMetaObject() {
    return true;
  }

  @ExportMessage
  public Type getMetaObject() {
    return getType();
  }

  private Map<String, Function> methods(EnsoContext ctx) {
    if (methods == null) {
      var builtinType = ctx.getBuiltins().getBuiltinType(builtinName);
      var defScope = builtinType.getType().getDefinitionScope();
      var methodsFromScope = defScope.getMethodsForType(builtinType.getType());
      // TODO: If null the methods is empty set
      assert methodsFromScope != null;
      methods = new HashMap<>();
      for (var m : methodsFromScope) {
        methods.put(m.getName(), m);
      }
    }
    return methods;
  }

  private Set<String> methodNames(EnsoContext ctx) {
    var methodNames =
        methods(ctx).keySet().stream()
            .map(
                funcName -> {
                  var funcNameItems = funcName.split("\\.");
                  return funcNameItems[funcNameItems.length - 1];
                })
            .collect(Collectors.toUnmodifiableSet());
    return methodNames;
  }

  private static boolean assertBuiltinDefined(String builtinName) {
    var builtinType = EnsoContext.get(null).getBuiltins().getBuiltinType(builtinName);
    if (builtinType == null) {
      throw new AssertionError("Builtin type " + builtinName + " is not defined");
    }
    return true;
  }
}
