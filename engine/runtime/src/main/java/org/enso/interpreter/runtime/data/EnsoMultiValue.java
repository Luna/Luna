package org.enso.interpreter.runtime.data;

import com.oracle.truffle.api.CompilerAsserts;
import com.oracle.truffle.api.CompilerDirectives.CompilationFinal;
import com.oracle.truffle.api.CompilerDirectives.TruffleBoundary;
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Cached.Shared;
import com.oracle.truffle.api.dsl.GenerateUncached;
import com.oracle.truffle.api.dsl.NeverDefault;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.interop.ArityException;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.InvalidArrayIndexException;
import com.oracle.truffle.api.interop.UnknownIdentifierException;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.interop.UnsupportedTypeException;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import com.oracle.truffle.api.nodes.ExplodeLoop;
import com.oracle.truffle.api.nodes.Node;
import java.math.BigInteger;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.TreeSet;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.enso.interpreter.node.callable.resolver.MethodResolverNode;
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.callable.UnresolvedSymbol;
import org.enso.interpreter.runtime.callable.function.Function;
import org.enso.interpreter.runtime.data.vector.ArrayLikeHelpers;
import org.enso.interpreter.runtime.library.dispatch.TypesLibrary;
import org.graalvm.collections.Pair;

@ExportLibrary(TypesLibrary.class)
@ExportLibrary(InteropLibrary.class)
public final class EnsoMultiValue extends EnsoObject {
  private final MultiType dispatch;
  private final MultiType extra;

  @CompilationFinal(dimensions = 1)
  private final Object[] values;

  private EnsoMultiValue(MultiType dispatch, MultiType extra, Object[] values) {
    this.dispatch = dispatch;
    this.extra = extra;
    this.values = values;
  }

  /** Creates new instance of EnsoMultiValue from provided information. */
  @GenerateUncached
  public abstract static class NewNode extends Node {
    private static final String INLINE_CACHE_LIMIT = "5";

    @NeverDefault
    public static NewNode create() {
      return EnsoMultiValueFactory.NewNodeGen.create();
    }

    @NeverDefault
    public static NewNode getUncached() {
      return EnsoMultiValueFactory.NewNodeGen.getUncached();
    }

    /**
     * Creates new multi value from provided information.
     *
     * @param types all the types this value can be {@link CastToNode cast to}
     * @param dispatchTypes the (subset of) types that the value is cast to currently - bigger than
     *     {@code 0} and at most {@code type.length}
     * @param values value of each of the provided {@code types}
     * @return non-{@code null} multi value instance
     */
    @NeverDefault
    public EnsoMultiValue newValue(
        @NeverDefault Type[] types,
        @NeverDefault int dispatchTypes,
        @NeverDefault Object... values) {
      assert dispatchTypes > 0;
      assert dispatchTypes <= types.length;
      assert types.length == values.length;
      assert !Stream.of(values).anyMatch(v -> v instanceof EnsoMultiValue)
          : "Avoid double wrapping " + Arrays.toString(values);
      var dt = executeTypes(types, 0, dispatchTypes);
      var et = executeTypes(types, dispatchTypes, types.length);
      return new EnsoMultiValue(dt, et, values);
    }

    abstract MultiType executeTypes(Type[] types, int from, int to);

    @Specialization(
        guards = {"compareTypes(cachedTypes, types, from, to)"},
        limit = INLINE_CACHE_LIMIT)
    final MultiType cachedMultiType(
        Type[] types,
        int from,
        int to,
        @Cached(value = "clone(types, from, to)", dimensions = 1) Type[] cachedTypes,
        @Cached("createMultiType(cachedTypes, from, to)") MultiType result) {
      return result;
    }

    @Specialization(replaces = "cachedMultiType")
    final MultiType createMultiType(Type[] types, int from, int to) {
      return MultiType.create(types, from, to);
    }

    @TruffleBoundary
    static final Type[] clone(Type[] types, int from, int to) {
      return Arrays.copyOfRange(types, from, to);
    }

    @ExplodeLoop
    static final boolean compareTypes(Type[] cached, Type[] arr, int from, int to) {
      CompilerAsserts.partialEvaluationConstant(cached);
      if (cached.length != to - from) {
        return false;
      }
      CompilerAsserts.partialEvaluationConstant(cached.length);
      for (var i = 0; i < cached.length; i++) {
        CompilerAsserts.partialEvaluationConstant(cached[i]);
        if (cached[i] != arr[from++]) {
          return false;
        }
      }
      return true;
    }
  }

  @ExportMessage
  boolean hasType() {
    return true;
  }

  @ExportMessage
  boolean hasSpecialDispatch() {
    return true;
  }

  @ExportMessage
  final Type getType() {
    return dispatch.types[0];
  }

  @ExportMessage
  final Type[] allTypes(boolean includeExtraTypes) {
    if (!includeExtraTypes) {
      return dispatch.allTypesWith(null);
    } else {
      return dispatch.allTypesWith(extra);
    }
  }

  @ExportMessage
  @TruffleBoundary
  @Override
  public final String toDisplayString(boolean ignore) {
    return toString();
  }

  private enum InteropType {
    NULL,
    BOOLEAN,
    DATE_TIME_ZONE,
    DURATION,
    STRING,
    NUMBER,
    POINTER,
    META_OBJECT,
    ITERATOR;

    private record Value(InteropType type, Object value) {}

    static Value find(Object[] values, int max, InteropLibrary iop) {
      for (var i = 0; i < max; i++) {
        var v = values[i];
        if (iop.isNull(v)) {
          return new Value(NULL, v);
        }
        if (iop.isBoolean(v)) {
          return new Value(BOOLEAN, v);
        }
        if (iop.isDate(v) || iop.isTime(v) || iop.isTimeZone(v)) {
          return new Value(DATE_TIME_ZONE, v);
        }
        if (iop.isDuration(v)) {
          return new Value(DURATION, v);
        }
        if (iop.isString(v)) {
          return new Value(STRING, v);
        }
        if (iop.isNumber(v)) {
          return new Value(NUMBER, v);
        }
        if (iop.isPointer(v)) {
          return new Value(POINTER, v);
        }
        if (iop.isMetaObject(v)) {
          return new Value(META_OBJECT, v);
        }
        if (iop.isIterator(v)) {
          return new Value(ITERATOR, v);
        }
      }
      return new Value(null, null);
    }
  }

  private InteropType.Value findInteropTypeValue(InteropLibrary iop) {
    return InteropType.find(values, dispatch.types.length, iop);
  }

  @ExportMessage
  boolean isBoolean(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop) {
    var both = findInteropTypeValue(iop);
    return both.type() == InteropType.BOOLEAN;
  }

  @ExportMessage
  boolean asBoolean(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop)
      throws UnsupportedMessageException {
    var both = findInteropTypeValue(iop);
    if (both.type() == InteropType.BOOLEAN) {
      return iop.asBoolean(both.value());
    }
    throw UnsupportedMessageException.create();
  }

  @ExportMessage
  boolean isString(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop) {
    var both = findInteropTypeValue(iop);
    return both.type() == InteropType.STRING;
  }

  @ExportMessage
  String asString(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop)
      throws UnsupportedMessageException {
    var both = findInteropTypeValue(iop);
    if (both.type() == InteropType.STRING) {
      return iop.asString(both.value());
    }
    throw UnsupportedMessageException.create();
  }

  @ExportMessage
  boolean isNumber(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop) {
    var both = findInteropTypeValue(iop);
    return both.type() == InteropType.NUMBER;
  }

  @ExportMessage
  boolean fitsInByte(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop) {
    var both = findInteropTypeValue(iop);
    return both.type() == InteropType.NUMBER && iop.fitsInByte(both.value());
  }

  @ExportMessage
  boolean fitsInShort(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop) {
    var both = findInteropTypeValue(iop);
    return both.type() == InteropType.NUMBER && iop.fitsInShort(both.value());
  }

  @ExportMessage
  boolean fitsInInt(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop) {
    var both = findInteropTypeValue(iop);
    return both.type() == InteropType.NUMBER && iop.fitsInInt(both.value());
  }

  @ExportMessage
  boolean fitsInLong(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop) {
    var both = findInteropTypeValue(iop);
    return both.type() == InteropType.NUMBER && iop.fitsInLong(both.value());
  }

  @ExportMessage
  boolean fitsInFloat(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop) {
    var both = findInteropTypeValue(iop);
    return both.type() == InteropType.NUMBER && iop.fitsInFloat(both.value());
  }

  @ExportMessage
  boolean fitsInDouble(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop) {
    var both = findInteropTypeValue(iop);
    return both.type() == InteropType.NUMBER && iop.fitsInDouble(both.value());
  }

  @ExportMessage
  byte asByte(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop)
      throws UnsupportedMessageException {
    var both = findInteropTypeValue(iop);
    if (both.type() == InteropType.NUMBER) {
      return iop.asByte(both.value());
    }
    throw UnsupportedMessageException.create();
  }

  @ExportMessage
  short asShort(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop)
      throws UnsupportedMessageException {
    var both = findInteropTypeValue(iop);
    if (both.type() == InteropType.NUMBER) {
      return iop.asShort(both.value());
    }
    throw UnsupportedMessageException.create();
  }

  @ExportMessage
  int asInt(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop)
      throws UnsupportedMessageException {
    var both = findInteropTypeValue(iop);
    if (both.type() == InteropType.NUMBER) {
      return iop.asInt(both.value());
    }
    throw UnsupportedMessageException.create();
  }

  @ExportMessage
  long asLong(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop)
      throws UnsupportedMessageException {
    var both = findInteropTypeValue(iop);
    if (both.type() == InteropType.NUMBER) {
      return iop.asLong(both.value());
    }
    throw UnsupportedMessageException.create();
  }

  @ExportMessage
  float asFloat(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop)
      throws UnsupportedMessageException {
    var both = findInteropTypeValue(iop);
    if (both.type() == InteropType.NUMBER) {
      return iop.asFloat(both.value());
    }
    throw UnsupportedMessageException.create();
  }

  @ExportMessage
  double asDouble(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop)
      throws UnsupportedMessageException {
    var both = findInteropTypeValue(iop);
    if (both.type() == InteropType.NUMBER) {
      return iop.asDouble(both.value());
    }
    throw UnsupportedMessageException.create();
  }

  @ExportMessage
  boolean fitsInBigInteger(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop) {
    var both = findInteropTypeValue(iop);
    return both.type() == InteropType.NUMBER && iop.fitsInBigInteger(both.value());
  }

  @ExportMessage
  BigInteger asBigInteger(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop)
      throws UnsupportedMessageException {
    var both = findInteropTypeValue(iop);
    if (both.type() == InteropType.NUMBER) {
      return iop.asBigInteger(both.value());
    }
    throw UnsupportedMessageException.create();
  }

  @ExportMessage
  boolean isTime(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop) {
    var both = findInteropTypeValue(iop);
    return both.type() == InteropType.DATE_TIME_ZONE && iop.isTime(both.value());
  }

  @ExportMessage
  LocalTime asTime(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop)
      throws UnsupportedMessageException {
    var both = findInteropTypeValue(iop);
    if (both.type() == InteropType.DATE_TIME_ZONE) {
      return iop.asTime(both.value());
    }
    throw UnsupportedMessageException.create();
  }

  @ExportMessage
  boolean isDate(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop) {
    var both = findInteropTypeValue(iop);
    return both.type() == InteropType.DATE_TIME_ZONE && iop.isDate(both.value());
  }

  @ExportMessage
  LocalDate asDate(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop)
      throws UnsupportedMessageException {
    var both = findInteropTypeValue(iop);
    if (both.type() == InteropType.DATE_TIME_ZONE) {
      return iop.asDate(both.value());
    }
    throw UnsupportedMessageException.create();
  }

  @ExportMessage
  boolean isTimeZone(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop) {
    var both = findInteropTypeValue(iop);
    return both.type() == InteropType.DATE_TIME_ZONE && iop.isTimeZone(both.value());
  }

  @ExportMessage
  ZoneId asTimeZone(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop)
      throws UnsupportedMessageException {
    var both = findInteropTypeValue(iop);
    if (both.type() == InteropType.DATE_TIME_ZONE) {
      return iop.asTimeZone(both.value());
    }
    throw UnsupportedMessageException.create();
  }

  @ExportMessage
  boolean isDuration(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop) {
    var both = findInteropTypeValue(iop);
    return both.type() == InteropType.DURATION;
  }

  @ExportMessage
  Duration asDuration(@Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop)
      throws UnsupportedMessageException {
    var both = findInteropTypeValue(iop);
    if (both.type() == InteropType.DURATION) {
      return iop.asDuration(both.value());
    }
    throw UnsupportedMessageException.create();
  }

  @ExportMessage
  boolean hasMembers() {
    return true;
  }

  @ExportMessage
  @TruffleBoundary
  Object getMembers(
      boolean includeInternal, @Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop) {
    var names = new TreeSet<String>();
    for (var i = 0; i < dispatch.types.length; i++) {
      try {
        var members = iop.getMembers(values[i]);
        var len = iop.getArraySize(members);
        for (var j = 0L; j < len; j++) {
          var name = iop.readArrayElement(members, j);
          names.add(iop.asString(name));
        }
      } catch (InvalidArrayIndexException | UnsupportedMessageException ex) {
      }
    }
    return ArrayLikeHelpers.wrapObjectsWithCheckAt(names.toArray());
  }

  @ExportMessage
  boolean isMemberInvocable(
      String name, @Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop) {
    for (var i = 0; i < dispatch.types.length; i++) {
      if (iop.isMemberInvocable(values[i], name)) {
        return true;
      }
    }
    return false;
  }

  @ExportMessage
  Object invokeMember(
      String name,
      Object[] args,
      @Shared("interop") @CachedLibrary(limit = "10") InteropLibrary iop)
      throws UnsupportedMessageException,
          ArityException,
          UnsupportedTypeException,
          UnknownIdentifierException {
    for (var i = 0; i < dispatch.types.length; i++) {
      if (iop.isMemberInvocable(values[i], name)) {
        return iop.invokeMember(values[i], name, args);
      }
    }
    throw UnknownIdentifierException.create(name);
  }

  @TruffleBoundary
  @Override
  public String toString() {
    var dt = Arrays.stream(dispatch.types);
    var et = Arrays.stream(extra.types);
    var both = Stream.concat(dt, et);
    return both.map(t -> t.getName()).collect(Collectors.joining(" & "));
  }

  /** Casts {@link EnsoMultiValue} to requested type effectively. */
  public static final class CastToNode extends Node {
    private static final CastToNode UNCACHED =
        new CastToNode(FindIndexNode.getUncached(), NewNode.getUncached());
    @Child private FindIndexNode findNode;
    @Child private NewNode newNode;

    private CastToNode(FindIndexNode f, NewNode n) {
      this.findNode = f;
      this.newNode = n;
    }

    @NeverDefault
    public static CastToNode create() {
      return new CastToNode(FindIndexNode.create(), NewNode.create());
    }

    @NeverDefault
    @TruffleBoundary
    public static CastToNode getUncached() {
      return UNCACHED;
    }

    /**
     * Casts value in a multi value into specific type.
     *
     * @param type the requested type
     * @param mv a multi value
     * @param reorderOnly allow (modified) {@link EnsoMultiValue} to be returned otherwise extract
     *     the value of {@code type} and return it directly
     * @param allTypes should we search all types or just up to {@code methodDispatchTypes}
     * @return instance of the {@code type} or {@code null} if no suitable value was found
     */
    public final Object findTypeOrNull(
        Type type, EnsoMultiValue mv, boolean reorderOnly, boolean allTypes) {
      var i = findNode.executeFindIndex(type, mv.dispatch);
      if (i == -1 && allTypes) {
        var extraIndex = findNode.executeFindIndex(type, mv.extra);
        i = extraIndex == -1 ? -1 : mv.dispatch.types.length + extraIndex;
      }
      if (i != -1) {
        if (reorderOnly) {
          var copyTypes = mv.dispatch.allTypesWith(mv.extra);
          var copyValues = mv.values.clone();
          copyTypes[0] = copyTypes[i];
          copyValues[0] = copyValues[i];
          copyTypes[i] = mv.dispatch.types[0];
          copyValues[i] = mv.values[0];
          return newNode.newValue(copyTypes, 1, copyValues);
        } else {
          return mv.values[i];
        }
      } else {
        return null;
      }
    }
  }

  @GenerateUncached
  abstract static class FindIndexNode extends Node {
    private static final String INLINE_CACHE_LIMIT = "5";

    abstract int executeFindIndex(Type type, MultiType mt);

    @NeverDefault
    public static FindIndexNode create() {
      return EnsoMultiValueFactory.FindIndexNodeGen.create();
    }

    @NeverDefault
    public static FindIndexNode getUncached() {
      return EnsoMultiValueFactory.FindIndexNodeGen.getUncached();
    }

    @Specialization(
        guards = {"type == cachedType", "mt == cachedMt"},
        limit = INLINE_CACHE_LIMIT)
    int findsCachedIndexOfAType(
        Type type,
        MultiType mt,
        @Cached("type") Type cachedType,
        @Cached("mt") MultiType cachedMt,
        @Cached(allowUncached = true, value = "findsAnIndexOfAType(type, mt)") int cachedIndex) {
      return cachedIndex;
    }

    @Specialization(replaces = "findsCachedIndexOfAType")
    int findsAnIndexOfAType(Type type, MultiType mt) {
      var ctx = EnsoContext.get(this);
      var index = mt.find(ctx, type);
      return index;
    }
  }

  /**
   * Tries to resolve the symbol in one of multi value types.
   *
   * @param node resolution node to use
   * @param symbol symbol to resolve
   * @return {@code null} when no resolution was found or pair of function and type solved
   */
  public final Pair<Function, Type> resolveSymbol(
      MethodResolverNode node, UnresolvedSymbol symbol) {
    var ctx = EnsoContext.get(node);
    Pair<Function, Type> foundAnyMethod = null;
    for (var t : dispatch.types) {
      var fnAndType = node.execute(t, symbol);
      if (fnAndType != null) {
        if (dispatch.types.length == 1 || fnAndType.getRight() != ctx.getBuiltins().any()) {
          return Pair.create(fnAndType.getLeft(), t);
        }
        foundAnyMethod = fnAndType;
      }
    }
    return foundAnyMethod;
  }

  /**
   * Internal representation of {@code Type[]} that supports identity comparision with {@code ==} to
   * support inline caching of values.
   */
  static final class MultiType {
    private static final ConcurrentHashMap<MultiType, MultiType> ALL_TYPES =
        new ConcurrentHashMap<>();

    @CompilationFinal(dimensions = 1)
    private final Type[] types;

    private MultiType(Type[] types) {
      this.types = types;
    }

    @TruffleBoundary
    static MultiType create(Type[] types, int from, int to) {
      var mt = new MultiType(Arrays.copyOfRange(types, from, to));
      return ALL_TYPES.computeIfAbsent(mt, java.util.function.Function.identity());
    }

    private int find(EnsoContext ctx, Type type) {
      for (var i = 0; i < types.length; i++) {
        for (var t : types[i].allTypes(ctx)) {
          if (t == type) {
            return i;
          }
        }
      }
      return -1;
    }

    @Override
    @TruffleBoundary
    public int hashCode() {
      int hash = 7;
      hash = 89 * hash + Arrays.deepHashCode(this.types);
      return hash;
    }

    @Override
    @TruffleBoundary
    public boolean equals(Object obj) {
      if (this == obj) {
        return true;
      }
      if (obj == null) {
        return false;
      }
      if (getClass() != obj.getClass()) {
        return false;
      }
      final MultiType other = (MultiType) obj;
      return Arrays.deepEquals(this.types, other.types);
    }

    private Type[] allTypesWith(MultiType nextOrNull) {
      if (nextOrNull == null || nextOrNull.types.length == 0) {
        return this.types.clone();
      } else {
        var next = nextOrNull;
        var arr = new Type[this.types.length + next.types.length];
        System.arraycopy(this.types, 0, arr, 0, types.length);
        System.arraycopy(next.types, 0, arr, types.length, next.types.length);
        return arr;
      }
    }

    @Override
    @TruffleBoundary
    public String toString() {
      return "MultiType{" + "types=" + Arrays.toString(types) + '}';
    }
  }
}
