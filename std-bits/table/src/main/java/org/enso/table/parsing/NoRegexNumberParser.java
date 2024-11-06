package org.enso.table.parsing;

import org.enso.base.parser.FormatDetectingNumberParser;
import org.enso.base.parser.NegativeSign;
import org.enso.base.parser.NumberWithSeparators;
import org.enso.table.data.column.builder.Builder;
import org.enso.table.data.column.builder.NumericBuilder;
import org.enso.table.data.column.storage.Storage;
import org.enso.table.data.column.storage.type.IntegerType;
import org.enso.table.parsing.problems.CommonParseProblemAggregator;
import org.enso.table.parsing.problems.ParseProblemAggregator;
import org.enso.table.problems.ProblemAggregator;
import org.graalvm.polyglot.Context;

public class NoRegexNumberParser extends IncrementalDatatypeParser {
  /**
   * Creates a new integer instance of this parser.
   *
   * @param integerTargetType the target type describing how large integer values can be accepted
   * @param trimValues whether to trim the input values
   * @param decimalPoint the decimal point set for the current format, or null if not specified;
   *     this parser does not use decimal point (since it is for integers) but it ensure that if a
   *     decimal point is chosen, the inferred thousand separator will not clash with that specific
   *     decimal point
   * @param thousandSeparator the thousand separator to use (if null then will be inferred)
   */
  public static NoRegexNumberParser createIntegerParser(
      IntegerType integerTargetType,
      boolean trimValues,
      String decimalPoint,
      String thousandSeparator) {
    return new NoRegexNumberParser(
        true,
        integerTargetType,
        trimValues,
        decimalPoint,
        thousandSeparator);
  }

  /**
   * Creates a new decimal instance of this parser.
   *
   * @param trimValues whether to trim the input values
   * @param decimalPoint the decimal point set for the current format (if null
   *                     then will be inferred)
   * @param thousandSeparator the thousand separator to use (if null then will
   *                          be inferred)
   */
  public static NoRegexNumberParser createDecimalParser(
      boolean trimValues,
      String decimalPoint,
      String thousandSeparator) {
    return new NoRegexNumberParser(
        false,
        null,
        trimValues,
        decimalPoint,
        thousandSeparator);
  }

  private final IntegerType integerTargetType;
  private final boolean isInteger;
  private final boolean trimValues;

  private final FormatDetectingNumberParser parser;

  private NoRegexNumberParser(
      boolean isInteger,
      IntegerType integerTargetType,
      boolean trimValues,
      String decimalPoint,
      String thousandSeparator) {
    this.isInteger = isInteger;
    this.integerTargetType = integerTargetType;
    this.trimValues = trimValues;

    var numberWithSeparators = NumberWithSeparators.fromSeparators(thousandSeparator, decimalPoint);
    this.parser = new FormatDetectingNumberParser(NegativeSign.UNKNOWN, numberWithSeparators);
  }

  @Override
  protected Builder makeBuilderWithCapacity(int capacity, ProblemAggregator problemAggregator) {
    return isInteger
        ? NumericBuilder.createLongBuilder(capacity, integerTargetType, problemAggregator)
        : NumericBuilder.createDoubleBuilder(capacity, problemAggregator);
  }

  @Override
  public Storage<?> parseColumn(Storage<String> sourceStorage, CommonParseProblemAggregator problemAggregator) {
    Builder builder = makeBuilderWithCapacity(sourceStorage.size(), problemAggregator.createSimpleChild());

    var context = Context.getCurrent();
    for (int i = 0; i < sourceStorage.size(); i++) {
      var text = sourceStorage.getItemBoxed(i);

      // Check if in unknown state
      var isInMixedState = !isInteger && (parser.numberWithSeparators()  == NumberWithSeparators.DOT_UNKNOWN || parser.numberWithSeparators() == NumberWithSeparators.COMMA_UNKNOWN);

      // Try and parse the value
      var result = text == null ? null : parseSingleValue(text, problemAggregator);

      // Do we need to rescan?
      if (!isInMixedState && parser.numberWithSeparators() != NumberWithSeparators.DOT_COMMA) {
        builder = makeBuilderWithCapacity(sourceStorage.size(), problemAggregator.createSimpleChild());
        for (int j = 0; j < i; j++) {
          var subText = sourceStorage.getItemBoxed(j);
          var subResult = subText == null ? null : parseSingleValue(subText, problemAggregator);
          if (subResult == null) {
            builder.appendNulls(1);
          } else {
            builder.append(subResult);
          }
        }
      }

      // Append the result
      if (result == null) {
        builder.appendNulls(1);
      } else {
        builder.append(result);
      }

      context.safepoint();
    }

    return builder.seal();
  }

  @Override
  public Object parseSingleValue(String text, ParseProblemAggregator problemAggregator) {
    var trimmed = text.trim();

    // The parser ignores leading white space so have to check it here.
    if (!trimValues) {
      if (!text.equals(trimmed)) {
        problemAggregator.reportInvalidFormat(text);
        return null;
      }
    }

    // Deal with NaN and Infinity
    if (!isInteger) {
      switch (trimmed) {
        case "NaN" -> {
          return Double.NaN;
        }
        case "Infinity" -> {
          return Double.POSITIVE_INFINITY;
        }
        case "-Infinity" -> {
          // Check the validity of the negative sign
          if (parser.negativeSign() == NegativeSign.BRACKET_OPEN) {
            problemAggregator.reportInvalidFormat(text);
            return null;
          }

          // Record the negative sign
          if (parser.negativeSign() == NegativeSign.UNKNOWN) {
            parser.setNegativeSign(NegativeSign.MINUS);
          }

          return Double.NEGATIVE_INFINITY;
        }
        case "(Infinity)" -> {
          // Check the validity of the negative sign
          if (parser.negativeSign() == NegativeSign.MINUS) {
            problemAggregator.reportInvalidFormat(text);
            return null;
          }

          // Record the negative sign
          if (parser.negativeSign() == NegativeSign.UNKNOWN) {
            parser.setNegativeSign(NegativeSign.BRACKET_OPEN);
          }

          return Double.NEGATIVE_INFINITY;
        }
      }
    }

    var result = parser.parse(trimmed, isInteger);

    if (result instanceof FormatDetectingNumberParser.NumberParseFailure) {
      problemAggregator.reportInvalidFormat(text);
      return null;
    }

    return switch (result) {
      case FormatDetectingNumberParser.NumberParseDouble doubleResult -> doubleResult.number();
      case FormatDetectingNumberParser.NumberParseLong longResult -> longResult.number();
      default -> throw new IllegalStateException("Unexpected result type: " + result.getClass());
    };
  }
}
