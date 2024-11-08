package org.enso.base.parser;

import static org.enso.base.parser.NumberWithSeparators.isDigit;

import java.nio.CharBuffer;

public record Separators(char first, char second, int count, int endIdx, int lastSeparator) {
  /** Check if the character is a separator. */
  static boolean isSeparator(char c) {
    return c == '.' || c == ',' || c == ' ' || c == '\'';
  }

  /**
   * Strip out the specified separators and replace with just full stop for decimal. If any
   * character other than a digit, thousands or decimal separator is encountered then return null.
   * If multiple decimal separators are encountered then return null.
   */
  static CharSequence strip(
      CharSequence value, int startIdx, int endIdx, char thousands, char decimal) {
    boolean foundDecimal = false;
    char[] results = new char[endIdx - startIdx];
    int resultIdx = 0;
    for (int i = startIdx; i < endIdx; i++) {
      char c = value.charAt(i);
      if (c == decimal) {
        if (foundDecimal) {
          return null;
        }
        results[resultIdx++] = '.';
        foundDecimal = true;
      } else if (isDigit(c)) {
        results[resultIdx++] = c;
      } else if (c != thousands) {
        return null;
      }
    }
    return CharBuffer.wrap(results, 0, resultIdx);
  }

  private static boolean validChar(char c, char first, char second) {
    return isDigit(c)
        || (first == NumberWithSeparators.Constants.NONE
            ? isSeparator(c)
            : (second == NumberWithSeparators.Constants.NONE
                ? c == first || c == ',' || c == '.'
                : c == second));
  }

  /**
   * Find the number and separators section. Validate the spacing of separators. Return the
   * separators found or null if invalid.
   */
  static Separators parse(CharSequence value, int idx, boolean integer) {
    int endIdx = idx;
    char firstSeparator = NumberWithSeparators.Constants.NONE;
    char secondSeparator = NumberWithSeparators.Constants.NONE;

    boolean firstWasSeparator = false;
    int lastSeparator = -1;
    int separatorCount = 0;

    // Scan the text, find and validate spacing of separators.
    // Space and ' are both valid thousands separators, but can't be second separator.
    // ToDo: Cope with scientific notation.
    char c = value.charAt(idx);
    while (endIdx < value.length() && validChar(c, firstSeparator, secondSeparator)) {
      if (!isDigit(c)) {
        if (lastSeparator == -1) {
          if (endIdx == idx) {
            // If first digit is a separator then only valid if a decimal separator.
            firstWasSeparator = true;
            if (!integer && (c != '.' && c != ',')) {
              return null;
            }
          }

          firstSeparator = c;
          separatorCount = 1;
          lastSeparator = endIdx;
        } else {
          // Encountered a second separator -  must be 4 away from last separator.
          if (endIdx != lastSeparator + 4) {
            if (firstSeparator == ' ' && c == ' ') {
              // Special case when the thousands separator is a space and there
              // is white space after the number (e.g. before a symbil).
              // Such as 1 234 567 USD.
              break;
            }
            return null;
          }

          if (firstSeparator != c) {
            if (!integer && secondSeparator == NumberWithSeparators.Constants.NONE) {
              secondSeparator = c;
            } else if (secondSeparator != c) {
              return null;
            }
          } else if (firstWasSeparator) {
            // Must have been a decimal separator.
            return null;
          }

          lastSeparator = endIdx;
          separatorCount++;
        }
      }

      endIdx++;
      if (endIdx < value.length()) {
        c = value.charAt(endIdx);
      }
    }

    // Special case when firstSeparator is a space and no secondSeparator and ending with a space.
    if (firstSeparator == ' '
        && secondSeparator == NumberWithSeparators.Constants.NONE
        && value.charAt(endIdx - 1) == ' ') {
      separatorCount--;
      endIdx--;
      lastSeparator -= 4;
      if (separatorCount == 0) {
        firstSeparator = NumberWithSeparators.Constants.NONE;
      }
    }

    // If in integer mode then must be a thousands separator, validate final spacing.
    if (integer && separatorCount > 0 && lastSeparator != endIdx - 4) {
      return null;
    }

    return new Separators(firstSeparator, secondSeparator, separatorCount, endIdx, lastSeparator);
  }
}
