package org.enso.base.parser;

import java.util.Optional;
import org.enso.base.parser.FormatDetectingNumberParser.NumberParseDouble;
import org.enso.base.parser.FormatDetectingNumberParser.NumberParseFailure;
import org.enso.base.parser.FormatDetectingNumberParser.NumberParseLong;
import org.enso.base.parser.FormatDetectingNumberParser.NumberParseResult;

/**
 * Number parsing with separators. Specifies the universe of number formats that can be parsed. Two
 * special cases, where we default to English format over European:
 *
 * <ul>
 *   <li>Encounter a single . or , with 3 trailing numbers.
 *   <li>Could be either DOT_COMMA or COMMA_DOT.
 *   <li>If a single . then uses DOT_UNKNOWN.
 *   <li>If a single , then uses COMMA_UNKNOWN.
 * </ul>
 */
public enum NumberWithSeparators {
  UNKNOWN(Constants.UNKNOWN, Constants.UNKNOWN),

  // Special case where we have encountered a . with 3 trailing digits. Such as
  // ##0.123 ###.123
  DOT_UNKNOWN(Constants.UNKNOWN, '.'),
  // Special case where we have encountered a single . within 3 digits from
  // start and without 3 digits from end. Such as ##3.1# or ##3.1415...
  UNKNOWN_DOT(Constants.UNKNOWN, '.'),
  // Special case where we have encountered a , with 3 trailing digits. Such as
  // ##0,123 ###,123
  COMMA_UNKNOWN(',', Constants.UNKNOWN),
  // Special case where we have encountered a single . within 3 digits from
  // start and without 3 digits from end. Such as ##3,1# or ##3,1415...
  UNKNOWN_COMMA(Constants.UNKNOWN, ','),

  NO_UNKNOWN(Constants.NONE, Constants.UNKNOWN),
  NO_DOT(Constants.NONE, '.'),
  NO_COMMA(Constants.NONE, ','),

  // European format (e.g. 1.234,56)
  DOT_COMMA('.', ','),

  // English format (e.g. 1,234.56)
  COMMA_DOT(',', '.'),

  SPACE_UNKNOWN(' ', Constants.UNKNOWN),
  SPACE_DOT(' ', '.'),
  SPACE_COMMA(' ', ','),

  SWISS_UNKNOWN('\'', Constants.UNKNOWN),
  SWISS_DOT('\'', '.'),
  SWISS_COMMA('\'', ',');

  public static NumberWithSeparators fromSeparators(String thousand, String decimal) {
    if (thousand != null && thousand.length() > 1) {
      throw new IllegalArgumentException("Invalid thousand separator (more than one character).");
    }

    if (decimal != null && decimal.length() > 1) {
      throw new IllegalArgumentException("Invalid decimal separator (more than one character).");
    }

    char thousands =
        thousand == null
            ? Constants.UNKNOWN
            : (thousand.isEmpty() ? Constants.NONE : thousand.charAt(0));
    char decimals =
        decimal == null
            ? Constants.UNKNOWN
            : (decimal.isEmpty() ? Constants.NONE : decimal.charAt(0));

    Optional<NumberWithSeparators> matched =
        switch (thousands) {
          case Constants.NONE -> matchForNone(decimals);
          case Constants.UNKNOWN -> matchForUnknown(decimals);
          case ',' -> Optional.of(COMMA_DOT);
          case '.' -> Optional.of(DOT_COMMA);
          case ' ' -> matchForSpace(decimals);
          case '\'' -> matchForSwiss(decimals);
          default -> Optional.empty();
        };

    if (matched.isEmpty()) {
      throw new IllegalArgumentException("Invalid separators.");
    }
    return matched.get();
  }

  private static Optional<NumberWithSeparators> matchForNone(char decimal) {
    return switch (decimal) {
      case Constants.UNKNOWN -> Optional.of(NO_UNKNOWN);
      case '.' -> Optional.of(NO_DOT);
      case ',' -> Optional.of(NO_COMMA);
      default -> Optional.empty();
    };
  }

  private static Optional<NumberWithSeparators> matchForUnknown(char decimal) {
    return switch (decimal) {
      case Constants.UNKNOWN -> Optional.of(UNKNOWN);
      case '.' -> Optional.of(UNKNOWN_DOT);
      case ',' -> Optional.of(UNKNOWN_COMMA);
      default -> Optional.empty();
    };
  }

  private static Optional<NumberWithSeparators> matchForSpace(char decimal) {
    return switch (decimal) {
      case Constants.UNKNOWN -> Optional.of(SPACE_UNKNOWN);
      case '.' -> Optional.of(SPACE_DOT);
      case ',' -> Optional.of(SPACE_COMMA);
      default -> Optional.empty();
    };
  }

  private static Optional<NumberWithSeparators> matchForSwiss(char decimal) {
    return switch (decimal) {
      case Constants.UNKNOWN -> Optional.of(SWISS_UNKNOWN);
      case '.' -> Optional.of(SWISS_DOT);
      case ',' -> Optional.of(SWISS_COMMA);
      default -> Optional.empty();
    };
  }

  static class Constants {
    static final char NONE = '\0';
    static final char UNKNOWN = '\uFFFD';
  }

  static boolean isDigit(char c) {
    return (c >= '0' && c <= '9');
  }

  private final char thousands;
  private final char decimal;

  NumberWithSeparators(char thousands, char decimal) {
    this.thousands = thousands;
    this.decimal = decimal;
  }

  public char getThousands() {
    return thousands;
  }

  public char getDecimal() {
    return decimal;
  }

  /**
   * While currently the format is treated as English, could be incorrect and actually is European.
   */
  public boolean mightBeEuropean() {
    return this == COMMA_UNKNOWN || this == DOT_UNKNOWN;
  }

  NumberParseResult parse(
      CharSequence value, int idx, boolean integer, boolean allowExponentialNotation) {
    var separators = Separators.parse(value, idx, integer, allowExponentialNotation);
    if (separators == null) {
      return new NumberParseFailure("Invalid separators.");
    }

    if (thousands != Constants.UNKNOWN && (integer || decimal != Constants.UNKNOWN)) {
      // If we have a fixed format then we can parse the number.
      return integer
          ? parseFixedInteger(value, idx, separators.endIdx(), separators.first())
          : parseFixedDecimal(
              value, idx, separators.endIdx(), separators.first(), separators.second());
    }

    return integer
        ? parseUnknownInteger(
            value, idx, separators.endIdx(), separators.first(), separators.count())
        : parseUnknownDecimal(
            value,
            idx,
            separators.endIdx(),
            separators.first(),
            separators.second(),
            separators.count(),
            separators.lastSeparatorIdx());
  }

  /** Internal record for returning when a new format is matched. */
  record NumberParseResultWithFormat(NumberWithSeparators format, NumberParseResult result)
      implements NumberParseResult {}

  /** Internal record for returning the end index of the matched number. */
  record NumberParseResultWithIndex(int endIdx, NumberParseResult result)
      implements NumberParseResult {}

  /** Given a known integer format, parse the sequence. */
  private NumberParseResult parseFixedInteger(
      CharSequence value, int idx, int endIdx, char firstSeparator) {
    assert thousands != Constants.UNKNOWN;

    // Validate Separator.
    if (firstSeparator != thousands) {
      return new NumberParseFailure(
          "Invalid separator (expected " + thousands + ", actual " + firstSeparator + ".");
    }

    // Strip out the separators.
    int origEndIdx = endIdx;
    if (thousands != Constants.NONE) {
      value = Separators.strip(value, idx, endIdx, thousands, decimal);
      if (value == null) {
        return new NumberParseFailure("Invalid number.");
      }
      idx = 0;
      endIdx = value.length();
    }

    try {
      long number = Long.parseLong(value, idx, endIdx, 10);
      return new NumberParseResultWithIndex(origEndIdx, new NumberParseLong(number, ""));
    } catch (NumberFormatException e) {
      return new NumberParseFailure("Invalid number.");
    }
  }

  /** Parse an unknown format with no separators. */
  private NumberParseResult parseUnknownIntegerNone(CharSequence value, int idx, int endIdx) {
    assert thousands == Constants.UNKNOWN;

    // We haven't encountered any separators. So parse the number as a long.
    try {
      long number = Long.parseLong(value, idx, endIdx, 10);
      var result = new NumberParseResultWithIndex(endIdx, new NumberParseLong(number, ""));

      // If greater than or equal 1000, then we know no thousand separators.
      if (number >= 1000) {
        var format =
            switch (decimal) {
              case '.' -> NO_DOT;
              case ',' -> NO_COMMA;
              default -> NO_UNKNOWN;
            };

        if (this != format) {
          return new NumberParseResultWithFormat(format, result);
        }
      }

      return result;
    } catch (NumberFormatException e) {
      return new NumberParseFailure("Invalid number.");
    }
  }

  /** Parse an unknown Integer format. */
  private NumberParseResult parseUnknownInteger(
      CharSequence value, int idx, int endIdx, char separator, int separatorCount) {
    assert thousands == Constants.UNKNOWN;

    if (separator == Constants.NONE) {
      // Didn't encounter any separators so use simpler logic.
      return parseUnknownIntegerNone(value, idx, endIdx);
    }

    // Find the correct format
    var format =
        switch (separator) {
          case '.' -> DOT_COMMA;
          case ',' -> separatorCount == 1 ? COMMA_UNKNOWN : COMMA_DOT;
          case ' ' -> (decimal == Constants.UNKNOWN
              ? SPACE_UNKNOWN
              : (decimal == '.' ? SPACE_DOT : SPACE_COMMA));
          case '\'' -> (decimal == Constants.UNKNOWN
              ? SWISS_UNKNOWN
              : (decimal == '.' ? SWISS_DOT : SWISS_COMMA));
          default -> null;
        };
    if (format == null) {
      return new NumberParseFailure("No matching number format.");
    }

    var result = format.parseFixedInteger(value, idx, endIdx, separator);
    return (result instanceof NumberParseFailure)
        ? result
        : new NumberParseResultWithFormat(format, result);
  }

  /** Given a known double format, parse the sequence. */
  private NumberParseResult parseFixedDecimal(
      CharSequence value, int idx, int endIdx, char firstSeparator, char secondSeparator) {
    // Deal with the special cases first.
    if (this == DOT_UNKNOWN || this == UNKNOWN_DOT) {
      // Haven't encountered a thousand separator, but know the decimal separator.
      // If DOT_UNKNOWN then could be European or English, but treat as English.
      assert firstSeparator == '.' && secondSeparator == Constants.NONE;
      return NO_DOT.parseFixedDecimal(value, idx, endIdx, Constants.NONE, '.');
    } else if (this == COMMA_UNKNOWN) {
      // Have only encountered a Comma(s), so treat as English format (COMMA_DOT).
      assert firstSeparator == ',' && secondSeparator == Constants.NONE;
      return COMMA_DOT.parseFixedDecimal(value, idx, endIdx, ',', '.');
    } else if (this == UNKNOWN_COMMA) {
      // Have encountered a comma and know is a decimal separator.
      assert firstSeparator == ',' && secondSeparator == Constants.NONE;
      return NO_COMMA.parseFixedDecimal(value, idx, endIdx, Constants.NONE, ',');
    }

    assert thousands != Constants.UNKNOWN && decimal != Constants.UNKNOWN;

    // Validate Separators.
    if (firstSeparator != Constants.NONE) {
      if ((secondSeparator == Constants.NONE
              && firstSeparator != thousands
              && firstSeparator != decimal)
          || (secondSeparator != Constants.NONE
              && (firstSeparator != thousands || secondSeparator != decimal))) {
        return new NumberParseFailure("Invalid separator.");
      }
    }

    // Strip out the separators.
    int origEndIdx = endIdx;
    if (thousands != Constants.NONE || decimal != '.') {
      value = Separators.strip(value, idx, endIdx, thousands, decimal);
      if (value == null) {
        return new NumberParseFailure("Invalid number.");
      }
      idx = 0;
      endIdx = value.length();
    }

    try {
      double number = Double.parseDouble(value.subSequence(idx, endIdx).toString());
      return new NumberParseResultWithIndex(origEndIdx, new NumberParseDouble(number, ""));
    } catch (NumberFormatException e) {
      return new NumberParseFailure("Invalid number.");
    }
  }

  /** Given a unknown format, parse the sequence. */
  private NumberParseResult parseUnknownDecimal(
      CharSequence value,
      int idx,
      int endIdx,
      char firstSeparator,
      char secondSeparator,
      int separatorCount,
      int lastSeparatorIdx) {
    assert thousands == Constants.UNKNOWN || decimal == Constants.UNKNOWN;

    // Cases of no separators or repeated single separator - must be integer.
    if (firstSeparator == Constants.NONE
        || (secondSeparator == Constants.NONE
            && (separatorCount > 1 || firstSeparator == ' ' || firstSeparator == '\''))) {
      var result =
          thousands == Constants.UNKNOWN
              ? parseUnknownInteger(value, idx, endIdx, firstSeparator, separatorCount)
              : parseFixedInteger(
                  value, idx, endIdx, separatorCount == 0 ? thousands : firstSeparator);

      // Special case if COMMA_UNKNOWN and count > 1 then is COMMA_DOT.
      boolean resolveCommaUnknown = this == COMMA_UNKNOWN && separatorCount > 1;
      return (result instanceof NumberParseFailure)
          ? result
          : (resolveCommaUnknown ? new NumberParseResultWithFormat(COMMA_DOT, result) : result);
    }

    // Need to resolve the format.
    NumberWithSeparators format = null;
    if (secondSeparator != Constants.NONE) {
      format =
          switch (firstSeparator) {
            case '.' -> secondSeparator == ',' ? DOT_COMMA : null;
            case ',' -> secondSeparator == '.' ? COMMA_DOT : null;
            case ' ' -> secondSeparator == '.'
                ? SPACE_DOT
                : secondSeparator == ',' ? SPACE_COMMA : null;
            case '\'' -> secondSeparator == '.'
                ? SWISS_DOT
                : secondSeparator == ',' ? SWISS_COMMA : null;
            default -> null;
          };
    } else if (firstSeparator == '.') {
      // if separatorCount > 1, must be a thousand separator, hence DOT_COMMA (covered above).
      // if index of separator > 3, must be a decimal point without a thousand separator, hence
      // NO_DOT.
      // if 3 digits following then could either, hence DOT_UNKNOWN.
      // Otherwise, must be decimal point, hence UNKNOWN_DOT.
      format =
          lastSeparatorIdx - idx > 3
              ? NO_DOT
              : (lastSeparatorIdx != endIdx - 4 ? UNKNOWN_DOT : DOT_UNKNOWN);
    } else if (firstSeparator == ',') {
      // if separatorCount > 1, must be a thousand separator, hence COMMA_DOT (covered above).
      // if index of separator > 3, must be a decimal point without a thousand separator, hence
      // NO_COMMA.
      // if 3 digits following then could either, hence COMMA_UNKNOWN.
      // Otherwise, must be decimal point, hence UNKNOWN_COMMA.
      format =
          lastSeparatorIdx - idx > 3
              ? NO_COMMA
              : (lastSeparatorIdx != endIdx - 4 ? UNKNOWN_COMMA : COMMA_UNKNOWN);
    }
    if (format == null) {
      return new NumberParseFailure("No matching number format.");
    }

    var result = format.parseFixedDecimal(value, idx, endIdx, firstSeparator, secondSeparator);
    return (result instanceof NumberParseFailure)
        ? result
        : new NumberParseResultWithFormat(format, result);
  }
}
