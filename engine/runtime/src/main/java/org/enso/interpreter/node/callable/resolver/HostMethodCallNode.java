package org.enso.interpreter.node.callable.resolver;

import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Cached.Shared;
import com.oracle.truffle.api.dsl.GenerateUncached;
import com.oracle.truffle.api.dsl.ImportStatic;
import com.oracle.truffle.api.dsl.ReportPolymorphism;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.interop.ArityException;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.UnknownIdentifierException;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.interop.UnsupportedTypeException;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.profiles.BranchProfile;
import org.enso.interpreter.node.expression.builtin.interop.syntax.HostValueToEnsoNode;
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.callable.UnresolvedSymbol;
import org.enso.interpreter.runtime.error.PanicException;

/** Discovers and performs method calls on foreign values. */
@GenerateUncached
@ReportPolymorphism
@ImportStatic(HostMethodCallNode.PolyglotCallType.class)
public abstract class HostMethodCallNode extends Node {

  /** Represents a mode of calling a method on a polyglot value. */
  public enum PolyglotCallType {
    /**
     * The method call should be handled through {@link InteropLibrary#invokeMember(Object, String,
     * Object...)}.
     */
    CALL_METHOD,
    /**
     * The method call should be handled through {@link InteropLibrary#readMember(Object, String)}.
     */
    GET_MEMBER,
    /**
     * The method call should be handled through {@link InteropLibrary#instantiate(Object,
     * Object...)}.
     */
    INSTANTIATE,
    /**
     * The method call should be handled by converting {@code self} to a {@link
     * org.enso.interpreter.runtime.data.text.Text} and dispatching natively.
     */
    CONVERT_TO_TEXT,
    /**
     * The method call should be handled by converting {@code self} to a {@link EnsoBigInteger} and
     * dispatching natively.
     */
    CONVERT_TO_BIG_INT,
    /**
     * The method call should be handled by converting {@code self} dispatching natively to methods
     * of {@link org.enso.interpreter.runtime.data.Array}
     */
    CONVERT_TO_ARRAY,
    /**
     * The method call should be handled by converting {@code self} to a {@code
     * Standard.Base.Data.Time.Date} and dispatching natively.
     */
    CONVERT_TO_DATE,
    /**
     * The method call should be handled by converting {@code self} to a {@code
     * Standard.Base.Data.Time.Date_Time} and dispatching natively.
     */
    CONVERT_TO_ZONED_DATE_TIME,
    /**
     * The method call should be handled by converting {@code self} to a {@code
     * Standard.Base.Data.Time.Date_Time} with a system Time_Zone and dispatching natively.
     */
    CONVERT_TO_DATE_TIME,
    /**
     * The method call should be handled by converting {@code self} to a {@code
     * Standard.Base.Data.Time.Duration} and dispatching natively.
     */
    CONVERT_TO_DURATION,
    /**
     * The method call should be handled by converting {@code self} to a {@code
     * Standard.Base.Data.Time.Time_Of_Day} and dispatching natively.
     */
    CONVERT_TO_TIME_OF_DAY,
    /**
     * The method call should be handled by converting {@code self} to a {@code
     * Standard.Base.Data.Time.Time_Zone} and dispatching natively.
     */
    CONVERT_TO_TIME_ZONE,
    /**
     * The method call should be handled by converting {@code self} to a {@code
     * Standard.Base.Data.Map} and dispatching natively.
     */
    CONVERT_TO_HASH_MAP,
    /** The method call should be handled by dispatching through the {@code Any} type. */
    NOT_SUPPORTED;

    /**
     * Directly use {@link InteropLibrary}, or not. Types that return false are either {@link
     * #NOT_SUPPORTED unsupported} or require additional conversions like {@link #CONVERT_TO_TEXT}
     * and {@link #CONVERT_TO_DATE}.
     *
     * @return true if one can directly pass this object to {@link InteropLibrary}
     */
    public boolean isInteropLibrary() {
      return this != NOT_SUPPORTED
          && this != CONVERT_TO_ARRAY
          && this != CONVERT_TO_TEXT
          && this != CONVERT_TO_BIG_INT
          && this != CONVERT_TO_DATE
          && this != CONVERT_TO_DATE_TIME
          && this != CONVERT_TO_DURATION
          && this != CONVERT_TO_ZONED_DATE_TIME
          && this != CONVERT_TO_TIME_OF_DAY
          && this != CONVERT_TO_TIME_ZONE
          && this != CONVERT_TO_HASH_MAP;
    }
  }

  /**
   * Given a polyglot (foreign) object, this enum represents a target Enso type that the object
   * should be converted to before further dispatch.
   *
   * <p>For example, a {@code java.lang.String}, or any other polyglot object that {@link
   * InteropLibrary#isString(Object) is a string}, should be converted to the {@link
   * org.enso.interpreter.runtime.data.text.Text} builtin Enso type.
   */
  public enum PolyglotConversionType {
    /** The object should be converted to {@link org.enso.interpreter.runtime.data.text.Text}. */
    CONVERT_TO_TEXT,
    /**
     * The object should be converted to {@link org.enso.interpreter.runtime.number.EnsoBigInteger}.
     */
    CONVERT_TO_BIG_INT,
    /** The object should be converted to {@link org.enso.interpreter.runtime.data.vector.Array}. */
    CONVERT_TO_ARRAY,
    /** The object should be converted to {@link org.enso.interpreter.runtime.data.EnsoDate}. */
    CONVERT_TO_DATE,
    /** The object should be converted to {@link org.enso.interpreter.runtime.data.EnsoDateTime}. */
    CONVERT_TO_ZONED_DATE_TIME,
    /** The object should be converted to {@link org.enso.interpreter.runtime.data.EnsoDateTime}. */
    CONVERT_TO_DATE_TIME,
    /** The object should be converted to {@link org.enso.interpreter.runtime.data.EnsoDuration}. */
    CONVERT_TO_DURATION,
    /**
     * The object should be converted to {@link org.enso.interpreter.runtime.data.EnsoTimeOfDay}.
     */
    CONVERT_TO_TIME_OF_DAY,
    /** The object should be converted to {@link org.enso.interpreter.runtime.data.EnsoTimeZone}. */
    CONVERT_TO_TIME_ZONE,
    /**
     * The object should be converted to {@link org.enso.interpreter.runtime.data.hash.EnsoHashMap}.
     */
    CONVERT_TO_HASH_MAP,

    /** No need to convert the polyglot object, just pass it as is. */
    NO_CONVERSION
  }

  private static final String NEW_NAME = "new";

  static final int LIB_LIMIT = 3;

  /**
   * Returns a token instructing the caller about what mode of calling the given method should be
   * used.
   *
   * @param self the method call target
   * @param symbol symbol representing method to be resolved
   * @param library an instance of interop library to use for interacting with the target
   * @return a {@link PolyglotCallType} to use for this target and method
   */
  public static PolyglotCallType getPolyglotCallType(
      Object self, UnresolvedSymbol symbol, InteropLibrary library) {
    return getPolyglotCallType(self, symbol, library, null);
  }

  /**
   * Returns a token instructing the caller about what mode of calling the given method should be
   * used.
   *
   * @param self the method call target
   * @param symbol symbol representing method to be resolved
   * @param library an instance of interop library to use for interacting with the target
   * @param methodResolverNode {@code null} or real instances of the node to resolve methods
   * @return a {@link PolyglotCallType} to use for this target and method
   */
  public static PolyglotCallType getPolyglotCallType(
      Object self,
      UnresolvedSymbol symbol,
      InteropLibrary library,
      MethodResolverNode methodResolverNode) {
    var conversionType = getPolyglotConversionType(self, library);
    switch (conversionType) {
      case CONVERT_TO_TEXT -> {
        return PolyglotCallType.CONVERT_TO_TEXT;
      }
      case CONVERT_TO_BIG_INT -> {
        return PolyglotCallType.CONVERT_TO_BIG_INT;
      }
      case CONVERT_TO_DATE -> {
        return PolyglotCallType.CONVERT_TO_DATE;
      }
      case CONVERT_TO_ZONED_DATE_TIME -> {
        return PolyglotCallType.CONVERT_TO_ZONED_DATE_TIME;
      }
      case CONVERT_TO_DATE_TIME -> {
        return PolyglotCallType.CONVERT_TO_DATE_TIME;
      }
      case CONVERT_TO_DURATION -> {
        return PolyglotCallType.CONVERT_TO_DURATION;
      }
      case CONVERT_TO_TIME_OF_DAY -> {
        return PolyglotCallType.CONVERT_TO_TIME_OF_DAY;
      }
      case CONVERT_TO_TIME_ZONE -> {
        return PolyglotCallType.CONVERT_TO_TIME_ZONE;
      }
      case CONVERT_TO_HASH_MAP -> {
        return PolyglotCallType.CONVERT_TO_HASH_MAP;
      }
      case CONVERT_TO_ARRAY -> {
        if (methodResolverNode != null) {
          var ctx = EnsoContext.get(library);
          var arrayType = ctx.getBuiltins().array();
          var fn = methodResolverNode.execute(arrayType, symbol);
          if (fn != null) {
            return PolyglotCallType.CONVERT_TO_ARRAY;
          }
        }
      }
      default -> {}
    }

    try {
      String methodName = symbol.getName();
      if (library.isMemberInvocable(self, methodName)) {
        return PolyglotCallType.CALL_METHOD;
      } else if (library.isMemberReadable(self, methodName)) {
        return PolyglotCallType.GET_MEMBER;
      } else if (library.isInstantiable(self) && methodName.equals(NEW_NAME)) {
        return PolyglotCallType.INSTANTIATE;
      }
    } catch (TypeNotPresentException ex) {
      // no call, get or instantiate is possible
    }
    return PolyglotCallType.NOT_SUPPORTED;
  }

  /**
   * Returns a target Enso builtin type that the {@code polyglotObj} should be converted to before
   * further dispatch.
   *
   * <p>For example, {@code java.lang.String} should be converted to {@link
   * org.enso.interpreter.runtime.data.text.Text}.
   *
   * @param polyglotObj Polyglot (foreign) object to check for conversion.
   */
  public static PolyglotConversionType getPolyglotConversionType(
      Object polyglotObj, InteropLibrary interop) {
    if (interop.isDate(polyglotObj)) {
      if (interop.isTime(polyglotObj)) {
        if (interop.isTimeZone(polyglotObj)) {
          return PolyglotConversionType.CONVERT_TO_ZONED_DATE_TIME;
        } else {
          return PolyglotConversionType.CONVERT_TO_DATE_TIME;
        }
      } else {
        return PolyglotConversionType.CONVERT_TO_DATE;
      }
    } else if (interop.isTime(polyglotObj)) {
      return PolyglotConversionType.CONVERT_TO_TIME_OF_DAY;
    } else if (interop.isDuration(polyglotObj)) {
      return PolyglotConversionType.CONVERT_TO_DURATION;
    } else if (interop.isTimeZone(polyglotObj)) {
      return PolyglotConversionType.CONVERT_TO_TIME_ZONE;
    } else if (interop.fitsInBigInteger(polyglotObj)) {
      return PolyglotConversionType.CONVERT_TO_BIG_INT;
    } else if (interop.isString(polyglotObj)) {
      return PolyglotConversionType.CONVERT_TO_TEXT;
    } else if (interop.hasArrayElements(polyglotObj)) {
      return PolyglotConversionType.CONVERT_TO_ARRAY;
    } else if (interop.hasHashEntries(polyglotObj)) {
      return PolyglotConversionType.CONVERT_TO_HASH_MAP;
    }
    return PolyglotConversionType.NO_CONVERSION;
  }

  /**
   * Calls a method on an object, using a specified {@link PolyglotCallType}.
   *
   * @param callType the call type to perform
   * @param symbol the method name
   * @param self the call receiver
   * @param args the arguments
   * @return the result of calling the method on the receiver
   */
  public abstract Object execute(
      PolyglotCallType callType, String symbol, Object self, Object[] args);

  @Specialization(guards = {"callType == CALL_METHOD"})
  Object resolveHostMethod(
      PolyglotCallType callType,
      String symbol,
      Object self,
      Object[] args,
      @Shared("interop") @CachedLibrary(limit = "LIB_LIMIT") InteropLibrary members,
      @Shared("hostValueToEnsoNode") @Cached HostValueToEnsoNode hostValueToEnsoNode) {
    var ctx = EnsoContext.get(this);
    try {
      return hostValueToEnsoNode.execute(members.invokeMember(self, symbol, args));
    } catch (UnsupportedMessageException | UnknownIdentifierException e) {
      CompilerDirectives.transferToInterpreter();
      var err = ctx.getBuiltins().error().makeNotInvokable(self);
      throw new PanicException(err, e, this);
    } catch (ArityException e) {
      var err =
          ctx.getBuiltins()
              .error()
              .makeArityError(e.getExpectedMinArity(), e.getExpectedMaxArity(), e.getActualArity());
      throw new PanicException(err, this);
    } catch (UnsupportedTypeException e) {
      var err =
          ctx.getBuiltins()
              .error()
              .makeUnsupportedArgumentsError(e.getSuppliedValues(), e.getMessage());
      throw new PanicException(err, this);
    }
  }

  @Specialization(guards = {"callType == GET_MEMBER"})
  Object resolveHostField(
      PolyglotCallType callType,
      String symbol,
      Object self,
      Object[] args,
      @Shared("interop") @CachedLibrary(limit = "LIB_LIMIT") InteropLibrary members,
      @Shared("hostValueToEnsoNode") @Cached HostValueToEnsoNode hostValueToEnsoNode,
      @Cached BranchProfile errorProfile) {
    if (args.length != 0) {
      errorProfile.enter();
      throw new PanicException(
          EnsoContext.get(this).getBuiltins().error().makeArityError(0, 0, args.length), this);
    }
    try {
      return hostValueToEnsoNode.execute(members.readMember(self, symbol));
    } catch (UnsupportedMessageException | UnknownIdentifierException e) {
      throw EnsoContext.get(this).raiseAssertionPanic(this, null, e);
    }
  }

  @Specialization(guards = {"callType == INSTANTIATE"})
  Object resolveHostConstructor(
      PolyglotCallType callType,
      String symbol,
      Object self,
      Object[] args,
      @Shared("interop") @CachedLibrary(limit = "LIB_LIMIT") InteropLibrary instances,
      @Shared("hostValueToEnsoNode") @Cached HostValueToEnsoNode hostValueToEnsoNode) {
    try {
      return hostValueToEnsoNode.execute(instances.instantiate(self, args));
    } catch (UnsupportedMessageException e) {
      CompilerDirectives.transferToInterpreter();
      var ctx = EnsoContext.get(this);
      var err = ctx.getBuiltins().error().makeNotInvokable(self);
      throw new PanicException(err, e, this);
    } catch (ArityException e) {
      throw new PanicException(
          EnsoContext.get(this)
              .getBuiltins()
              .error()
              .makeArityError(e.getExpectedMinArity(), e.getExpectedMaxArity(), e.getActualArity()),
          this);
    } catch (UnsupportedTypeException e) {
      throw new PanicException(
          EnsoContext.get(this)
              .getBuiltins()
              .error()
              .makeUnsupportedArgumentsError(e.getSuppliedValues(), e.getMessage()),
          this);
    }
  }
}
