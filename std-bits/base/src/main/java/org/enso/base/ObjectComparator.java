package org.enso.base;

import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Value;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.util.Comparator;
import java.util.Locale;
import java.util.function.Function;
import java.util.function.BiFunction;

public class ObjectComparator implements Comparator<Object> {
  public static final ObjectComparator DEFAULT = new ObjectComparator();

  private static BiFunction<Object, Object, Integer> EnsoCompareCallback = null;

  private static void initCallbacks() {
    if (EnsoCompareCallback == null) {
      var module = Context.getCurrent().getBindings("enso").invokeMember("get_module", "Standard.Base.Data.Ordering");
      var type = module.invokeMember("get_type", "Comparable");

      var are_equal = module.invokeMember("get_method", type, "compare_callback");
      EnsoCompareCallback = (v, u) -> {
        var result = are_equal.execute(null, v, u);
        if (result.isNull()) {
          throw new ClassCastException( "Unable to compare " + v.toString() + " and " + u.toString());
        } else {
          return result.asInt();
        }
      };
    }
  }

  public static int ensoCompare(Object value, Object other) throws ClassCastException {
    initCallbacks();
    return EnsoCompareCallback.apply(value, other);
  }

  private static BiFunction<String, String, Integer> textComparator;

  public ObjectComparator() {
    this(false, Locale.ROOT);
  }

  public ObjectComparator(boolean caseSensitive, Locale locale) {
    if (caseSensitive) {
        textComparator = Text_Utils::compare_normalized;
        } else {
        textComparator = (a, b) -> Text_Utils.compare_normalized_ignoring_case(a, b, locale);
    }
  }

  public ObjectComparator(Function<Object, Function<Object, Value>> textComparator) {
    this.textComparator = (a, b) -> {
      var result = textComparator.apply(a).apply(b);
      if (result.isNull()) {
        throw new CompareException(a, b);
      }
      return result.asInt();
    };
  }

  @Override
  public int compare(Object thisValue, Object thatValue) {
    // NULLs
    if (thisValue == null) {
      if (thatValue != null) {
        return -1;
      }
      return 0;
    }
    if (thatValue == null) {
      return 1;
    }

    // Booleans
    if (thisValue instanceof Boolean thisBool && thatValue instanceof Boolean thatBool) {
      if (thisBool == thatBool) {
        return 0;
      }
      return thisBool ? 1 : -1;
    }

    // Long this
    if (thisValue instanceof Long thisLong) {
      if (thatValue instanceof Long thatLong) {
        return thisLong.compareTo(thatLong);
      }
      if (thatValue instanceof Double thatDouble) {
        if (thisLong > thatDouble) {
          return 1;
        }
        if (thisLong < thatDouble) {
          return -1;
        }
        return 0;
      }
    }

    // Double this
    if (thisValue instanceof Double thisDouble) {
      if (thatValue instanceof Double thatDouble) {
        return thisDouble.compareTo(thatDouble);
      }
      if (thatValue instanceof Long thatLong) {
        if (thisDouble > thatLong) {
          return 1;
        }
        if (thisDouble < thatLong) {
          return -1;
        }
        return 0;
      }
    }

    // Text
    if (thisValue instanceof String thisString && thatValue instanceof String thatString) {
      return this.textComparator.apply(thisString, thatString);
    }

    // DateTimes
    if (thisValue instanceof LocalDate thisDate) {
      if (thatValue instanceof LocalDate thatDate) {
        return thisDate.compareTo(thatDate);
      }
    }

    if (thisValue instanceof ZonedDateTime thisDateTime) {
      if (thatValue instanceof ZonedDateTime thatDateTime) {
        return thisDateTime.compareTo(thatDateTime);
      }
    }

    // TimeOfDay
    if (thisValue instanceof LocalTime thisTime) {
      if (thatValue instanceof LocalTime thatTime) {
        return thisTime.compareTo(thatTime);
      }
    }

    // Fallback to Enso
    return ensoCompare(thisValue, thatValue);
  }
}
