package org.enso.base.parser;

/**
 * Parse a String into a Number. It supports the following patterns: - SIGN + NUMBER; - BRACKETS +
 * SPACE + NUMBER + SPACE + BRACKET_CLOSE;
 */
public class FormatDetectingNumberParser {
  public interface NumberParseResult {}

  public interface NumberParseResultSuccess extends NumberParseResult {
    NumberParseResultSuccess negate();

    NumberParseResultSuccess withSymbol(String symbol);
  }

  public record NumberParseLong(long number, String symbol) implements NumberParseResultSuccess {
    @Override
    public NumberParseResultSuccess negate() {
      return new NumberParseLong(-number, symbol);
    }

    @Override
    public NumberParseResultSuccess withSymbol(String symbol) {
      return new NumberParseLong(number, symbol);
    }
  }

  public record NumberParseDouble(double number, String symbol)
      implements NumberParseResultSuccess {
    @Override
    public NumberParseResultSuccess negate() {
      return new NumberParseDouble(-number, symbol);
    }

    @Override
    public NumberParseResultSuccess withSymbol(String symbol) {
      return new NumberParseDouble(number, symbol);
    }
  }

  public record NumberParseFailure(String message) implements NumberParseResult {}

  private NegativeSign negativeSign;
  private NumberWithSeparators numberWithSeparators;

  public FormatDetectingNumberParser() {
    this(NegativeSign.UNKNOWN, NumberWithSeparators.UNKNOWN);
  }

  public FormatDetectingNumberParser(
      NegativeSign negativeSign, NumberWithSeparators numberWithSeparators) {
    this.negativeSign = negativeSign;
    this.numberWithSeparators = numberWithSeparators;
  }

  public NegativeSign negativeSign() {
    return negativeSign;
  }

  public NumberWithSeparators numberWithSeparators() {
    return numberWithSeparators;
  }

  public NumberParseResult parse(CharSequence value, boolean integer) {
    // State
    boolean encounteredSign = false;
    boolean isNegative = false;
    NumberParseResultSuccess number = null;
    String symbol = "";

    // Scan the value
    int idx = 0;
    int length = value.length();
    while (idx < length) {
      char c = value.charAt(idx);

      if (Character.isWhitespace(c)) {
        idx++;
      } else if (NumberWithSeparators.isDigit(c) || Separators.isSeparator(c)) {
        if (number != null) {
          return new NumberParseFailure("Multiple Number Sections.");
        }

        var numberPart = numberWithSeparators.parse(value, idx, integer);
        if (numberPart instanceof NumberWithSeparators.NumberParseResultWithFormat newFormat) {
          numberWithSeparators = newFormat.format();
          numberPart = newFormat.result();
        }
        if (numberPart instanceof NumberWithSeparators.NumberParseResultWithIndex newIndex) {
          idx = newIndex.endIdx();
          numberPart = newIndex.result();
        }
        if (numberPart instanceof NumberParseResultSuccess numberSuccess) {
          number = numberSuccess;
        } else {
          return numberPart;
        }
      } else if (NegativeSign.isOpenSign(c)) {
        if (encounteredSign || number != null) {
          return new NumberParseFailure("Unexpected sign character.");
        }

        var signOk = negativeSign.checkValid(c);
        if (signOk.isEmpty()) {
          return new NumberParseFailure("Inconsistent negative format.");
        }

        negativeSign = signOk.get();
        encounteredSign = true;
        isNegative = c != '+';
        idx++;
      } else if (c == ')') {
        if (!isNegative || negativeSign != NegativeSign.BRACKET_OPEN || number == null) {
          return new NumberParseFailure("Unexpected bracket close.");
        }

        // Should only be whitespace left.
        idx++;
        while (idx < length) {
          if (!Character.isWhitespace(value.charAt(idx))) {
            return new NumberParseFailure("Unexpected characters after bracket close.");
          }
          idx++;
        }

        // Negate here so can tell finished.
        number = number.negate();
        isNegative = false;
      } else {
        if (!symbol.isEmpty()) {
          return new NumberParseFailure("Multiple Symbol Sections.");
        }

        // ToDo: Locking symbol position within text parts.

        int endIdx = idx;
        while (endIdx < length
            && !NumberWithSeparators.isDigit(c)
            && !Separators.isSeparator(c)
            && !NegativeSign.isSign(c)
            && !Character.isWhitespace(c)) {
          endIdx++;
          if (endIdx < length) {
            c = value.charAt(endIdx);
          }
        }

        symbol = value.subSequence(idx, endIdx).toString();
        idx = endIdx;
      }
    }

    // Special check for unclosed bracket.
    if (negativeSign == NegativeSign.BRACKET_OPEN && isNegative) {
      return new NumberParseFailure("Unclosed bracket.");
    }

    // Fail if no number found.
    if (number == null) {
      return new NumberParseFailure("No Number Found.");
    }

    // Special Case When Have a Long and want a Double
    if (!integer && number instanceof NumberParseLong numberLong) {
      number = new NumberParseDouble(numberLong.number(), numberLong.symbol());
    }

    // Return Result
    number = isNegative ? number.negate() : number;
    return symbol.isEmpty() ? number : number.withSymbol(symbol);
  }

  public Long parseLong(CharSequence value) {
    var result = parse(value, true);
    if (result instanceof NumberParseLong numberSuccess) {
      return numberSuccess.number();
    }
    return null;
  }

  public Double parseDouble(CharSequence value) {
    var result = parse(value, false);
    if (result instanceof NumberParseDouble numberSuccess) {
      return numberSuccess.number();
    }
    return null;
  }

  public NumberParseResult[] parseMany(CharSequence[] values, boolean integer) {
    var results = new NumberParseResult[values.length];

    int i = 0;
    while (i < values.length) {
      var previous = numberWithSeparators;
      results[i] = parse(values[i], integer);

      if (numberWithSeparators != previous
          && ((previous == NumberWithSeparators.DOT_UNKNOWN
                  && numberWithSeparators != NumberWithSeparators.DOT_COMMA)
              || (previous == NumberWithSeparators.COMMA_UNKNOWN
                  && numberWithSeparators != NumberWithSeparators.DOT_COMMA))) {
        // Start scan over, as format was incorrect.
        i = 0;
      } else {
        i++;
      }
    }

    return results;
  }
}
