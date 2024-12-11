package org.enso.base.polyglot;

import org.graalvm.polyglot.Value;

import java.math.BigDecimal;
import java.math.BigInteger;

/**
 * The numeric converter deals with conversions of Java numeric types to the two main types
 * supported by Enso - Long for integers and Double for decimals. Any other types are coerced to one
 * of these types.
 *
 * <p>It provides two concepts - coercion - which allows to coerce an integer type to a decimal, but
 * will not convert a decimal to an integer even if it has 0 fractional part. Then there is
 * conversion which allows to convert a decimal with 0 fractional part to an integer. Conversion
 * should be used when we care about the original type of the object (i.e. we want any decimals to
 * require decimal storage even if they have 0 fractional part). Conversion is to be used when we
 * want to be consistent with Enso's equality semantics where 2 == 2.0.
 */
public class NumericConverter {
  /**
   * Coerces a number (possibly an integer) to a Double.
   *
   * <p>Will throw an exception if the object is not a number.
   */
  public static double coerceToDouble(Object o) {
    return switch (o) {
      case Double x -> x;
      case BigDecimal x -> x.doubleValue();
      case Float x -> x.doubleValue();
      case BigInteger x -> x.doubleValue();
      default -> (double) coerceToLong(o);
    };
  }

  public static double coerceToDouble(Value val) {
    if (val.fitsInDouble()) {
      return val.asDouble();
    }
    if (val.fitsInFloat()) {
      return Float.valueOf(val.asFloat()).doubleValue();
    }
    if (val.fitsInBigInteger()) {
      return val.asBigInteger().doubleValue();
    }
    if (Polyglot_Utils.asBigDecimal(val) instanceof BigDecimal bigDec) {
      return bigDec.doubleValue();
    }
    return (double) coerceToLong(val);
  }

  /**
   * Coerces a number to an Integer.
   *
   * <p>Will throw an exception if the object is not an integer.
   *
   * <p>Decimal values are not accepted.
   */
  public static long coerceToLong(Object o) {
    return switch (o) {
      case Long x -> x;
      case Integer x -> x.longValue();
      case Short x -> x.longValue();
      case Byte x -> x.longValue();
      default -> throw new UnsupportedOperationException("Cannot coerce " + o + " to a numeric type.");
    };
  }

  public static long coerceToLong(Value val) {
    if (val.fitsInLong()) {
      return val.asLong();
    }
    if (val.fitsInInt()) {
      return Integer.valueOf(val.asInt()).longValue();
    }
    if (val.fitsInShort()) {
      return Short.valueOf(val.asShort()).longValue();
    }
    if (val.fitsInByte()) {
      return Byte.valueOf(val.asByte()).longValue();
    }
    throw new UnsupportedOperationException("Cannot coerce " + val + " to a numeric type.");
  }

  public static BigInteger coerceToBigInteger(Object o) {
    if (o instanceof BigInteger bigInteger) {
      return bigInteger;
    } else {
      long longValue = coerceToLong(o);
      return BigInteger.valueOf(longValue);
    }
  }

  public static BigInteger coerceToBigInteger(Value val) {
    if (val.fitsInBigInteger()) {
      return val.asBigInteger();
    }
    var longValue = coerceToLong(val);
    return BigInteger.valueOf(longValue);
  }

  /**
   * Coerces a number to a BigDecimal.
   *
   * <p>Will throw an exception if the object is not a number.
   */
  public static BigDecimal coerceToBigDecimal(Object o) {
    return switch (o) {
      case Double x -> BigDecimal.valueOf(x);
      case BigDecimal x -> x;
      case Float x -> BigDecimal.valueOf(x);
      case BigInteger x -> new BigDecimal(x);
      case Long x -> BigDecimal.valueOf(x);
      case Integer x -> BigDecimal.valueOf(x);
      case Short x -> BigDecimal.valueOf(x);
      case Byte x -> BigDecimal.valueOf(x);
      default -> throw new UnsupportedOperationException("Cannot coerce " + o + " to a BigDecimal.");
    };
  }

  /**
   * Coerces a polyglot value to a BigDecimal.
   *
   * <p>Will throw an exception if the object is not a number.
   */
  public static BigDecimal coerceToBigDecimal(Value val) {
    if (val.fitsInDouble()) {
      return BigDecimal.valueOf(val.asDouble());
    }
    if (Polyglot_Utils.asBigDecimal(val) instanceof BigDecimal bd) {
      return bd;
    }
    if (val.fitsInFloat()) {
      return BigDecimal.valueOf(val.asFloat());
    }
    if (val.fitsInBigInteger()) {
      return new BigDecimal(val.asBigInteger());
    }
    if (val.fitsInLong()) {
      return BigDecimal.valueOf(val.asLong());
    }
    if (val.fitsInInt()) {
      return BigDecimal.valueOf(val.asInt());
    }
    if (val.fitsInShort()) {
      return BigDecimal.valueOf(val.asShort());
    }
    if (val.fitsInByte()) {
      return BigDecimal.valueOf(val.asByte());
    }
    throw new UnsupportedOperationException("Cannot coerce " + val + " to a BigDecimal.");
  }

  /** Returns true if the object is any supported number. */
  public static boolean isCoercibleToDouble(Object o) {
    return isFloatLike(o)|| isCoercibleToLong(o) || o instanceof BigInteger;
  }

  public static boolean isCoercibleToDouble(Value val) {
    return isFloatLike(val) || isCoercibleToLong(val) || val.fitsInBigInteger();
  }

  public static boolean isFloatLike(Object o) {
    return o instanceof Double
        || o instanceof Float;
  }

  public static boolean isFloatLike(Value val) {
    return val.fitsInDouble() || val.fitsInFloat();
  }

  /**
   * Returns true if the object is any supported integer.
   *
   * <p>Returns false for decimals with 0 fractional part - the type itself must be an integer type.
   */
  public static boolean isCoercibleToLong(Object o) {
    return o instanceof Long || o instanceof Integer || o instanceof Short || o instanceof Byte;
  }

  public static boolean isCoercibleToLong(Value val) {
    if (val.isNumber()) {
      return val.fitsInLong() || val.fitsInInt() || val.fitsInShort() || val.fitsInByte();
    }
    return false;
  }

  public static boolean isCoercibleToBigInteger(Object o) {
    return o instanceof BigInteger || isCoercibleToLong(o);
  }

  public static boolean isCoercibleToBigInteger(Value val) {
    return val.fitsInBigInteger() || isCoercibleToLong(val);
  }

  /**
   * Tries converting the value to a Double.
   *
   * <p>It will return null if the object represented a non-numeric value.
   */
  public static Double tryConvertingToDouble(Object o) {
    return switch (o) {
      case Double x -> x;
      case BigDecimal x -> x.doubleValue();
      case BigInteger x -> x.doubleValue();
      case Float x -> x.doubleValue();
      case Long x -> x.doubleValue();
      case Integer x -> x.doubleValue();
      case Short x -> x.doubleValue();
      case Byte x -> x.doubleValue();
      case null, default -> null;
    };
  }

  /**
   * Tries converting the value to a Long.
   *
   * <p>Decimal number types are accepted, only if their fractional part is 0. It will return null
   * if the object represented a non-integer value.
   */
  public static Long tryConvertingToLong(Object o) {
    return switch (o) {
      case Long x -> x;
      case Integer x -> x.longValue();
      case Short x -> x.longValue();
      case Byte x -> x.longValue();
      case Double x -> x % 1.0 == 0.0 ? x.longValue() : null;
      case Float x -> x % 1.0f == 0.0f ? x.longValue() : null;
      case BigDecimal x -> {
        try {
          yield x.longValueExact();
        } catch (ArithmeticException e) {
          yield null;
        }
      }
      case BigInteger x -> {
        try {
          yield x.longValueExact();
        } catch (ArithmeticException e) {
          yield null;
        }
      }
      case null, default -> null;
    };
  }

  public static boolean isBigInteger(Value v) {
    return v.fitsInBigInteger() && !v.fitsInLong();
  }

  /** A workaround for <a href="https://github.com/enso-org/enso/issues/7790">#7790</a> */
  public static BigDecimal bigIntegerAsBigDecimal(BigInteger x) {
    return new BigDecimal(x);
  }
}
