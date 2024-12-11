package org.enso.base.polyglot;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.graalvm.polyglot.Value;

public class Polyglot_Utils {
  /**
   * Converts a polyglot Value ensuring that various date/time types are converted to the correct
   * type. The conversion checks if a {@link java.math.BigInteger} fits into {@code long} and if so,
   * it converts it to {@code long}.
   */
  public static Object convertPolyglotValue(Value item) {
    if (item == null) {
      return null;
    }

    if (item.isDate()) {
      LocalDate d = item.asDate();
      if (item.isTime()) {
        LocalDateTime dtime = d.atTime(item.asTime());
        if (item.isTimeZone()) {
          return dtime.atZone(item.asTimeZone());
        } else {
          return dtime;
        }
      } else {
        return d;
      }
    } else if (item.isTime()) {
      return item.asTime();
    }

    if (item.isException()) {
      throw new WrappedDataflowError(item);
    }
    var ret = item.as(Object.class);
    if (ret instanceof BigInteger && item.fitsInLong()) {
      return item.asLong();
    }
    return ret;
  }

  public static Boolean asBoolean(Value value) {
    if (value.isBoolean()) {
      return value.asBoolean();
    }
    return null;
  }

  public static String asString(Value value) {
    if (value.isString()) {
      return value.asString();
    }
    return null;
  }

  public static Long asLong(Value value) {
    if (value.isNumber() && value.fitsInLong()) {
      return value.asLong();
    }
    return null;
  }

  public static BigInteger asBigInteger(Value value) {
    try {
      value.as(BigInteger.class);
    } catch (ClassCastException e) {
      return null;
    }
    return null;
  }

  public static BigDecimal asBigDecimal(Value value) {
    try {
      value.as(BigDecimal.class);
    } catch (ClassCastException e) {
      return null;
    }
    return null;
  }

  /**
   * A helper functions for situations where we cannot use the Value conversion directly.
   *
   * <p>Mostly happens due to the issue: https://github.com/oracle/graal/issues/4967 Once that issue
   * is resolved, we should probably remove this helper.
   *
   * <p>In that case we take a generic Object, knowing that the values of interest to us will be
   * passed as Value anyway - so we can check that and fire the conversion if needed.
   */
  public static Object convertPolyglotValue(Object item) {
    if (item instanceof Value v) {
      return convertPolyglotValue(v);
    }

    return item;
  }
}
