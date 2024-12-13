package org.enso.table.aggregations;

import java.math.BigInteger;
import java.util.List;
import org.enso.base.polyglot.NumericConverter;
import org.enso.table.data.column.builder.BigIntegerBuilder;
import org.enso.table.data.column.builder.Builder;
import org.enso.table.data.column.builder.DoubleBuilder;
import org.enso.table.data.column.builder.InferredIntegerBuilder;
import org.enso.table.data.column.operation.map.MapOperationProblemAggregator;
import org.enso.table.data.column.storage.Storage;
import org.enso.table.data.column.storage.type.BigIntegerType;
import org.enso.table.data.column.storage.type.FloatType;
import org.enso.table.data.column.storage.type.IntegerType;
import org.enso.table.data.table.Column;
import org.enso.table.data.table.problems.InvalidAggregation;
import org.enso.table.problems.ProblemAggregator;
import org.graalvm.polyglot.Context;

/** Aggregate Column computing the total value in a group. */
public class Sum extends Aggregator {
  private final Storage<?> inputStorage;

  public Sum(String name, Column column) {
    super(name);
    this.inputStorage = column.getStorage();
  }

  @Override
  public Builder makeBuilder(int size, ProblemAggregator problemAggregator) {
    var preciseInputType = inputStorage.inferPreciseType();
    return switch (preciseInputType) {
      case IntegerType integerType -> new InferredIntegerBuilder(size, problemAggregator);
      case BigIntegerType bigIntegerType -> new BigIntegerBuilder(size, problemAggregator);
      case FloatType floatType -> DoubleBuilder.createDoubleBuilder(size, problemAggregator);
      default -> throw new IllegalStateException("Unexpected input type for Sum aggregate: " + preciseInputType);
    };
  }

  @Override
  public Object aggregate(List<Integer> indexes, ProblemAggregator problemAggregator) {
    MapOperationProblemAggregator innerAggregator =
        new MapOperationProblemAggregator(problemAggregator, getName());
    Context context = Context.getCurrent();
    SumAccumulator accumulator = new SumAccumulator();
    for (int row : indexes) {
      Object value = inputStorage.getItemBoxed(row);
      accumulator.add(value);
      context.safepoint();
    }
    return accumulator.summarize();
  }

  private static class SumAccumulator {
    private Object accumulator = null;

    void add(Object value) {
      if (value == null) {
        return;
      }

      Long valueAsLong = NumericConverter.tryConvertingToLong(value);
      if (valueAsLong != null) {
        addLong(valueAsLong);
      } else if (value instanceof BigInteger) {
        addBigInteger((BigInteger) value);
      } else {
        Double valueAsDouble = NumericConverter.tryConvertingToDouble(value);
        if (valueAsDouble != null) {
          addDouble(valueAsDouble);
        } else {
          throw new IllegalStateException("Unexpected value type: " + value.getClass());
        }
      }
    }

    private void addLong(long value) {
      switch (accumulator) {
        case Long accumulatorAsLong -> {
          try {
            accumulator = Math.addExact(accumulatorAsLong, value);
          } catch (ArithmeticException exception) {
            accumulator = BigInteger.valueOf(accumulatorAsLong).add(BigInteger.valueOf(value));
          }
        }
        case BigInteger accumulatorAsBigInteger -> {
          accumulator = accumulatorAsBigInteger.add(BigInteger.valueOf(value));
        }
        case Double accumulatorAsDouble -> {
          accumulator = accumulatorAsDouble + value;
        }
        case null -> {
          accumulator = value;
        }
        default -> throw new IllegalStateException("Unexpected accumulator type: " + accumulator.getClass());
      }
    }

    private void addBigInteger(BigInteger value) {
      switch (accumulator) {
        case Long accumulatorAsLong -> {
          accumulator = BigInteger.valueOf(accumulatorAsLong).add(value);
        }
        case BigInteger accumulatorAsBigInteger -> {
          accumulator = accumulatorAsBigInteger.add(value);
        }
        case Double accumulatorAsDouble -> {
          accumulator = accumulatorAsDouble + value.doubleValue();
        }
        case null -> {
          accumulator = value;
        }
        default -> throw new IllegalStateException("Unexpected accumulator type: " + accumulator.getClass());
      }
    }

    private void addDouble(double value) {
      switch (accumulator) {
        case Long accumulatorAsLong -> {
          accumulator = ((double) accumulatorAsLong) + value;
        }
        case BigInteger accumulatorAsBigInteger -> {
          accumulator = accumulatorAsBigInteger.doubleValue() + value;
        }
        case Double accumulatorAsDouble -> {
          accumulator = accumulatorAsDouble + value;
        }
        case null -> {
          accumulator = value;
        }
        default -> throw new IllegalStateException("Unexpected accumulator type: " + accumulator.getClass());
      }
    }

    Object summarize() {
      return accumulator;
    }
  }
}
