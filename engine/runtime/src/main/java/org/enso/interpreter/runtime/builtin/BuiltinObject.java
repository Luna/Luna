package org.enso.interpreter.runtime.builtin;

import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.CompilerDirectives.CompilationFinal;
import com.oracle.truffle.api.CompilerDirectives.TruffleBoundary;
import com.oracle.truffle.api.dsl.Bind;
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Cached.Shared;
import com.oracle.truffle.api.dsl.NeverDefault;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.interop.ArityException;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.UnknownIdentifierException;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.interop.UnsupportedTypeException;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.profiles.LoopConditionProfile;
import java.util.HashMap;
import java.util.Map;
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

  @CompilationFinal
  private Builtin cachedBuiltinType;

  @CompilationFinal(dimensions = 1)
  private String[] methodNames;

  @CompilationFinal(dimensions = 1)
  private Function[] methods;

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
  public final Object getMembers(boolean includeInternal) {
    return ArrayLikeHelpers.wrapStrings(methodNames());
  }

  @ExportMessage
  public final boolean isMemberReadable(
      String member, @Shared @Cached LoopConditionProfile loopProfile) {
    var size = methodNames().length;
    loopProfile.profileCounted(size);
    for (var i = 0; loopProfile.inject(i < methodNames.length); i++) {
      var methodName = methodNames[i];
      if (member.compareTo(methodName) == 0) {
        return true;
      }
    }
    return false;
  }

  @ExportMessage
  public final boolean isMemberInvocable(
      String member, @Shared @Cached LoopConditionProfile loopProfile) {
    return isMemberReadable(member, loopProfile);
  }

  @ExportMessage
  public final Object readMember(String member, @Shared @Cached LoopConditionProfile loopProfile)
      throws UnknownIdentifierException {
    var methodNames = methodNames();
    var methods = methods();
    loopProfile.profileCounted(methodNames.length);
    for (var i = 0; loopProfile.inject(i < methodNames.length); i++) {
      var methodName = methodNames[i];
      if (methodName.compareTo(member) == 0) {
        return methods[i];
      }
    }
    throw UnknownIdentifierException.create(member);
  }

  @ExportMessage
  public static final class InvokeMember {
    @Specialization(
        guards = {"cachedMember.equals(member)"},
        limit = "3")
    public static Object doCached(
        BuiltinObject receiver,
        String member,
        Object[] args,
        @Cached("member") String cachedMember,
        @Cached("buildSymbol(cachedMember)") UnresolvedSymbol cachedSymbol,
        @CachedLibrary("cachedSymbol") InteropLibrary interop)
        throws UnsupportedMessageException, UnsupportedTypeException, ArityException {
      var argsForBuiltin = new Object[args.length + 1];
      argsForBuiltin[0] = receiver;
      java.lang.System.arraycopy(args, 0, argsForBuiltin, 1, args.length);
      return interop.execute(cachedSymbol, argsForBuiltin);
    }

    @Specialization(replaces = "doCached")
    public static Object doUncached(
        BuiltinObject receiver,
        String member,
        Object[] args,
        @CachedLibrary(limit = "3") InteropLibrary interop)
        throws UnsupportedMessageException, UnsupportedTypeException, ArityException {
      var ctx = EnsoContext.get(interop);
      var symbol = buildSymbol(member, ctx);
      return doCached(receiver, member, args, member, symbol, interop);
    }

    private static UnresolvedSymbol buildSymbol(String symbol, EnsoContext ctx) {
      return UnresolvedSymbol.build(symbol, ctx.getBuiltins().getScope());
    }

    @NeverDefault
    public static UnresolvedSymbol buildSymbol(String symbol) {
      var ctx = EnsoContext.get(null);
      return buildSymbol(symbol, ctx);
    }
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

  @TruffleBoundary
  private Map<String, Function> findMethods() {
    var ctx = EnsoContext.get(null);
    var builtinType = ctx.getBuiltins().getBuiltinType(builtinName);
    assert builtinType != null;
    var defScope = builtinType.getType().getDefinitionScope();
    var methodsFromScope = defScope.getMethodsForType(builtinType.getType());
    assert methodsFromScope != null;
    var methods = new HashMap<String, Function>();
    for (var method : methodsFromScope) {
      var methodName = normalizeName(method.getName());
      methods.put(methodName, method);
    }
    return methods;
  }

  private String[] methodNames() {
    if (methodNames == null) {
      CompilerDirectives.transferToInterpreter();
      var methods = findMethods();
      var namesSet =
          methods.keySet().stream()
              .map(BuiltinObject::normalizeName)
              .collect(Collectors.toUnmodifiableSet());
      methodNames = namesSet.toArray(String[]::new);
    }
    return methodNames;
  }

  private Function[] methods() {
    if (methods == null) {
      CompilerDirectives.transferToInterpreter();
      methods = findMethods().values().toArray(Function[]::new);
    }
    return methods;
  }

  private static String normalizeName(String funcName) {
    var funcNameItems = funcName.split("\\.");
    return funcNameItems[funcNameItems.length - 1];
  }
}
