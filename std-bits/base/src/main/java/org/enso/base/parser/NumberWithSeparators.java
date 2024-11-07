package org.enso.base.parser;

import java.util.Arrays;
import org.enso.base.parser.FormatDetectingNumberParser.NumberParseDouble;
import org.enso.base.parser.FormatDetectingNumberParser.NumberParseFailure;
import org.enso.base.parser.FormatDetectingNumberParser.NumberParseLong;
import org.enso.base.parser.FormatDetectingNumberParser.NumberParseResult;

/**
 * Number parsing with separators. Two special cases: - Encounter a single . or , with 3 trailing
 * numbers. - Could be either DOT_COMMA or COMMA_DOT. Hence, DOT_UNKNOWN and COMMA_UNKNOWN.
 */
public enum NumberWithSeparators {
  UNKNOWN(Constants.UNKNOWN, Constants.UNKNOWN),

  // Special case where we have encountered a . with 3 trailing digits. ##0.123 ####.123
  DOT_UNKNOWN(Constants.UNKNOWN, '.'),
  // Special case where we have encountered a single . within 3 digits from start and without 3
  // digits from end.
  UNKNOWN_DOT(Constants.UNKNOWN, '.'),
  // Special case where we have encountered a , with 3 trailing digits.
  COMMA_UNKNOWN(',', Constants.UNKNOWN),
  // Special case where we have encountered a single . within 3 digits from start and without 3
  // digits from end.
  UNKNOWN_COMMA(Constants.UNKNOWN, '.'),

  NO_UNKNOWN(Constants.NONE, Constants.UNKNOWN),
  NO_DOT(Constants.NONE, '.'),
  NO_COMMA(Constants.NONE, ','),

  DOT_COMMA('.', ','),

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

    // For these special cases if we know the decimal separator should fix it.
    if (thousands == Constants.UNKNOWN) {
      if (decimals == '.') {
        return UNKNOWN_DOT;
      } else if (decimals == ',') {
        return UNKNOWN_COMMA;
      }
    }

    var matched =
        Arrays.stream(values())
            .filter(v -> v.thousands == thousands && v.decimal == decimals)
            .findAny();
    if (matched.isEmpty()) {
      throw new IllegalArgumentException("Invalid separators.");
    }
    return matched.get();
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

  NumberParseResult parse(CharSequence value, int idx, boolean integer) {
    var separators = Separators.parse(value, idx, integer);
    if (separators == null) {
      return new NumberParseFailure("Invalid separators.");
    }

    if (thousands != Constants.UNKNOWN && (integer || decimal != Constants.UNKNOWN)) {
      // If we have a fixed format then we can parse the number.
      return integer
          ? parseFixedInteger(value, idx, separators.endIdx(), separators.first())
          : parseFixed(value, idx, separators.endIdx(), separators.first(), separators.second());
    }

    return integer
        ? parseUnknownInteger(
            value, idx, separators.endIdx(), separators.first(), separators.count())
        : parseUnknown(
            value,
            idx,
            separators.endIdx(),
            separators.first(),
            separators.second(),
            separators.count(),
            separators.lastSeparator());
  }

  /** Internal record for returning when a new format is matched. */
  record NumberParseResultWithFormat(NumberWithSeparators format, NumberParseResult result)
      implements NumberParseResult {}

  /** Internal record for returning when a new format is matched. */
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
  private NumberParseResult parseFixed(
      CharSequence value, int idx, int endIdx, char firstSeparator, char secondSeparator) {
    if (this == DOT_UNKNOWN || this == UNKNOWN_DOT) {
      assert firstSeparator == '.' && secondSeparator == Constants.NONE;
      return NO_DOT.parseFixed(value, idx, endIdx, Constants.NONE, '.');
    } else if (this == COMMA_UNKNOWN) {
      assert firstSeparator == ',' && secondSeparator == Constants.NONE;
      return COMMA_DOT.parseFixed(value, idx, endIdx, ',', '.');
    } else if (this == UNKNOWN_COMMA) {
      assert firstSeparator == ',' && secondSeparator == Constants.NONE;
      return NO_COMMA.parseFixed(value, idx, endIdx, Constants.NONE, ',');
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
  private NumberParseResult parseUnknown(
      CharSequence value,
      int idx,
      int endIdx,
      char firstSeparator,
      char secondSeparator,
      int separatorCount,
      int lastSeparator) {
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
          lastSeparator > 3 ? NO_DOT : (lastSeparator != endIdx - 4 ? UNKNOWN_DOT : DOT_UNKNOWN);
    } else if (firstSeparator == ',') {
      // if separatorCount > 1, must be a thousand separator, hence COMMA_DOT (covered above).
      // if index of separator > 3, must be a decimal point without a thousand separator, hence
      // NO_COMMA.
      // if 3 digits following then could either, hence COMMA_UNKNOWN.
      // Otherwise, must be decimal point, hence UNKNOWN_COMMA.
      format =
          lastSeparator > 3
              ? NO_COMMA
              : (lastSeparator != endIdx - 4 ? UNKNOWN_COMMA : COMMA_UNKNOWN);
    }
    if (format == null) {
      return new NumberParseFailure("No matching number format.");
    }

    var result = format.parseFixed(value, idx, endIdx, firstSeparator, secondSeparator);
    return (result instanceof NumberParseFailure)
        ? result
        : new NumberParseResultWithFormat(format, result);
  }
}
