package org.enso.table.data.column.storage;

import java.util.BitSet;
import java.util.HashMap;
import java.util.List;
import java.util.function.BiFunction;
import java.util.function.Function;
import org.enso.base.polyglot.Polyglot_Utils;
import org.enso.table.data.column.builder.Builder;
import org.enso.table.data.column.operation.cast.CastProblemAggregator;
import org.enso.table.data.column.operation.cast.StorageConverter;
import org.enso.table.data.column.operation.map.MapOperationProblemAggregator;
import org.enso.table.data.column.storage.numeric.LongStorage;
import org.enso.table.data.column.storage.type.IntegerType;
import org.enso.table.data.column.storage.type.StorageType;
import org.enso.table.data.mask.OrderMask;
import org.enso.table.data.mask.SliceRange;
import org.enso.table.problems.ProblemAggregator;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Value;

/** An abstract representation of a data column. */
public abstract class Storage<T> {
  /**
   * @return the number of elements in this column (including NAs)
   */
  public abstract int size();

  /**
   * @return the number of NA elements in this column
   */
  public abstract int countMissing();

  /**
   * @return the type tag of this column's storage.
   */
  public abstract StorageType getType();

  /**
   * @return the type of the values in this column's storage. Most storages just return their type.
   *     Mixed storage will try to see if all elements fit some more precise type.
   */
  public StorageType inferPreciseType() {
    return getType();
  }

  /**
   * Returns the smallest type (according to Column.auto_value_type rules) that may still fit all
   * values in this column.
   *
   * <p>It is a sibling of `inferPreciseType` that allows some further shrinking. It is kept
   * separate, because `inferPreciseType` should be quick to compute (cached if needed) as it is
   * used in typechecking of lots of operations. This one however, is only used in a specific
   * `auto_value_type` use-case and rarely will need to be computed more than once.
   */
  public StorageType inferPreciseTypeShrunk() {
    return getType();
  }

  /**
   * Returns a more specialized storage, if available.
   *
   * <p>This storage should have the same type as returned by {@code inferPreciseType}. See {@link
   * MixedStorage} for more information.
   */
  public Storage<?> tryGettingMoreSpecializedStorage() {
    return this;
  }

  /**
   * Checks whether the value at {@code idx} is missing.
   *
   * @param idx the index to check.
   * @return whether or not the value is missing.
   */
  public abstract boolean isNa(long idx);

  /**
   * Returns a boxed representation of an item. Missing values are denoted with null.
   *
   * @param idx the index to look up
   * @return the item at position {@code idx}
   */
  public abstract T getItemBoxed(int idx);

  /** A container for names of vectorizable operation. */
  public static final class Maps {
    public static final String EQ = "==";
    public static final String LT = "<";
    public static final String LTE = "<=";
    public static final String GT = ">";
    public static final String GTE = ">=";
    public static final String MUL = "*";
    public static final String ADD = "+";
    public static final String SUB = "-";
    public static final String DIV = "/";
    public static final String MOD = "%";
    public static final String POWER = "^";
    public static final String TRUNCATE = "truncate";
    public static final String CEIL = "ceil";
    public static final String FLOOR = "floor";
    public static final String ROUND = "round";
    public static final String NOT = "not";
    public static final String AND = "&&";
    public static final String OR = "||";
    public static final String IS_NOTHING = "is_nothing";
    public static final String IS_NAN = "is_nan";
    public static final String IS_INFINITE = "is_infinite";
    public static final String IS_EMPTY = "is_empty";
    public static final String STARTS_WITH = "starts_with";
    public static final String ENDS_WITH = "ends_with";
    public static final String TEXT_LENGTH = "text_length";
    public static final String TEXT_LEFT = "text_left";
    public static final String TEXT_RIGHT = "text_right";
    public static final String CONTAINS = "contains";
    public static final String LIKE = "like";
    public static final String IS_IN = "is_in";
    public static final String YEAR = "year";
    public static final String QUARTER = "quarter";
    public static final String MONTH = "month";
    public static final String WEEK = "week";
    public static final String DAY = "day";
    public static final String HOUR = "hour";
    public static final String MINUTE = "minute";
    public static final String SECOND = "second";
    public static final String MILLISECOND = "millisecond";
    public static final String MICROSECOND = "microsecond";
    public static final String NANOSECOND = "nanosecond";
  }

  /* Specifies if the given unary operation has a vectorized implementation available for this storage.*/
  public abstract boolean isUnaryOpVectorized(String name);

  /** Runs a vectorized unary operation. */
  public abstract Storage<?> runVectorizedUnaryMap(
      String name, MapOperationProblemAggregator problemAggregator);

  /* Specifies if the given binary operation has a vectorized implementation available for this storage.*/
  public abstract boolean isBinaryOpVectorized(String name);

  /** Runs a vectorized operation on this storage, taking one scalar argument. */
  public abstract Storage<?> runVectorizedBinaryMap(
      String name, Object argument, MapOperationProblemAggregator problemAggregator);

  /* Specifies if the given ternary operation has a vectorized implementation available for this storage.*/
  public boolean isTernaryOpVectorized(String name) {
    return false;
  }

  /** Runs a vectorized operation on this storage, taking two scalar arguments. */
  public Storage<?> runVectorizedTernaryMap(
      String name,
      Object argument0,
      Object argument1,
      MapOperationProblemAggregator problemAggregator) {
    throw new IllegalArgumentException("Unsupported ternary operation: " + name);
  }

  /**
   * Runs a vectorized operation on this storage, taking a storage as the right argument -
   * processing row-by-row.
   */
  public abstract Storage<?> runVectorizedZip(
      String name, Storage<?> argument, MapOperationProblemAggregator problemAggregator);

  /**
   * Runs a unary function on each non-null element in this storage.
   *
   * @param function the function to run.
   * @param skipNa whether rows containing missing values should be passed to the function.
   * @param expectedResultType the expected type for the result storage; it is ignored if the
   *     operation is vectorized
   * @return the result of running the function on each row
   */
  public final Storage<?> unaryMap(
      Function<Object, Value> function,
      boolean skipNa,
      StorageType expectedResultType,
      ProblemAggregator problemAggregator) {
    Builder storageBuilder = Builder.getForType(expectedResultType, size(), problemAggregator);
    Context context = Context.getCurrent();
    for (int i = 0; i < size(); i++) {
      Object it = getItemBoxed(i);
      if (skipNa && it == null) {
        storageBuilder.appendNulls(1);
      } else {
        Value result = function.apply(it);
        Object converted = Polyglot_Utils.convertPolyglotValue(result);
        storageBuilder.appendNoGrow(converted);
      }

      context.safepoint();
    }
    return storageBuilder.seal();
  }

  /**
   * Runs a 2-argument function on each element in this storage.
   *
   * @param function the function to run.
   * @param argument the argument to pass to each run of the function
   * @param skipNulls specifies whether null values on the input should result in a null result
   *     without passing them through the function, this is useful if the function does not support
   *     the null-values, but it needs to be set to false if the function should handle them.
   * @param expectedResultType the expected type for the result storage
   * @return a new storage containing results of the function for each row
   */
  public final Storage<?> binaryMap(
      BiFunction<Object, Object, Object> function,
      Object argument,
      boolean skipNulls,
      StorageType expectedResultType,
      ProblemAggregator problemAggregator) {
    Builder storageBuilder = Builder.getForType(expectedResultType, size(), problemAggregator);
    if (skipNulls && argument == null) {
      storageBuilder.appendNulls(size());
      return storageBuilder.seal();
    }

    Context context = Context.getCurrent();
    for (int i = 0; i < size(); i++) {
      Object it = getItemBoxed(i);
      if (skipNulls && it == null) {
        storageBuilder.appendNulls(1);
      } else {
        Object result = function.apply(it, argument);
        Object converted = Polyglot_Utils.convertPolyglotValue(result);
        storageBuilder.appendNoGrow(converted);
      }

      context.safepoint();
    }
    return storageBuilder.seal();
  }

  /**
   * Runs a function on each pair of non-missing elements in this and arg.
   *
   * @param function the function to run.
   * @param skipNa whether rows containing missing values should be passed to the function.
   * @param expectedResultType the expected type for the result storage; it is ignored if the
   *     operation is vectorized
   * @return the result of running the function on all non-missing elements.
   */
  public final Storage<?> zip(
      BiFunction<Object, Object, Object> function,
      Storage<?> arg,
      boolean skipNa,
      StorageType expectedResultType,
      ProblemAggregator problemAggregator) {
    Builder storageBuilder = Builder.getForType(expectedResultType, size(), problemAggregator);
    Context context = Context.getCurrent();
    for (int i = 0; i < size(); i++) {
      Object it1 = getItemBoxed(i);
      Object it2 = i < arg.size() ? arg.getItemBoxed(i) : null;
      if (skipNa && (it1 == null || it2 == null)) {
        storageBuilder.appendNulls(1);
      } else {
        Object result = function.apply(it1, it2);
        Object converted = Polyglot_Utils.convertPolyglotValue(result);
        storageBuilder.appendNoGrow(converted);
      }

      context.safepoint();
    }
    return storageBuilder.seal();
  }

  /**
   * Runs a unary operation.
   *
   * <p>If a vectorized implementation is available, it is used, otherwise the fallback is used.
   *
   * @param name the name of the vectorized operation
   * @param problemAggregator the problem aggregator to use for the vectorized implementation
   * @param fallback the fallback Enso function to run if vectorized implementation is not
   *     available; it should never raise dataflow errors.
   * @param skipNa whether rows containing missing values should be passed to the fallback function.
   * @param expectedResultType the expected type for the result storage; it is ignored if the
   *     operation is vectorized
   * @return the result of running the operation on each row
   */
  public final Storage<?> vectorizedOrFallbackUnaryMap(
      String name,
      MapOperationProblemAggregator problemAggregator,
      Function<Object, Value> fallback,
      boolean skipNa,
      StorageType expectedResultType) {
    if (isUnaryOpVectorized(name)) {
      return runVectorizedUnaryMap(name, problemAggregator);
    } else {
      checkFallback(fallback, expectedResultType, name);
      return unaryMap(fallback, skipNa, expectedResultType, problemAggregator);
    }
  }

  /**
   * Runs a binary operation with a scalar argument.
   *
   * <p>If a vectorized implementation is available, it is used, otherwise the fallback is used.
   *
   * @param name the name of the vectorized operation
   * @param problemAggregator the problem aggregator to use for the vectorized implementation
   * @param fallback the fallback Enso function to run if vectorized implementation is not
   *     available; it should never raise dataflow errors.
   * @param argument the argument to pass to each run of the function
   * @param skipNulls specifies whether null values on the input should result in a null result
   * @param expectedResultType the expected type for the result storage; it is ignored if the
   *     operation is vectorized
   * @return the result of running the operation on each row
   */
  public final Storage<?> vectorizedOrFallbackBinaryMap(
      String name,
      MapOperationProblemAggregator problemAggregator,
      BiFunction<Object, Object, Object> fallback,
      Object argument,
      boolean skipNulls,
      StorageType expectedResultType) {
    if (isBinaryOpVectorized(name)) {
      return runVectorizedBinaryMap(name, argument, problemAggregator);
    } else {
      checkFallback(fallback, expectedResultType, name);
      return binaryMap(fallback, argument, skipNulls, expectedResultType, problemAggregator);
    }
  }

  /**
   * Runs a ternary operation with two scalar arguments.
   *
   * <p>Does not take a fallback function.
   *
   * @param name the name of the vectorized operation
   * @param problemAggregator the problem aggregator to use for the vectorized implementation
   * @param argument0 the first argument to pass to each run of the function
   * @param argument1 the second argument to pass to each run of the function
   * @param skipNulls specifies whether null values on the input should result in a null result
   * @param expectedResultType the expected type for the result storage; it is ignored if the
   *     operation is vectorized
   * @return the result of running the operation on each row
   */
  public final Storage<?> vectorizedTernaryMap(
      String name,
      MapOperationProblemAggregator problemAggregator,
      Object argument0,
      Object argument1,
      boolean skipNulls,
      StorageType expectedResultType) {
    if (isTernaryOpVectorized(name)) {
      return runVectorizedTernaryMap(name, argument0, argument1, problemAggregator);
    } else {
      throw new IllegalArgumentException("Unsupported ternary operation: " + name);
    }
  }

  /**
   * Runs a binary operation with a storage argument.
   *
   * <p>If a vectorized implementation is available, it is used, otherwise the fallback is used.
   *
   * @param name the name of the vectorized operation
   * @param problemAggregator the problem aggregator to use for the vectorized implementation
   * @param fallback the fallback Enso function to run if vectorized implementation is not
   *     available; it should never raise dataflow errors.
   * @param other the other storage to zip with this one
   * @param skipNulls specifies whether null values on the input should result in a null result
   * @param expectedResultType the expected type for the result storage; it is ignored if the
   *     operation is vectorized
   * @return the result of running the operation on each row
   */
  public final Storage<?> vectorizedOrFallbackZip(
      String name,
      MapOperationProblemAggregator problemAggregator,
      BiFunction<Object, Object, Object> fallback,
      Storage<?> other,
      boolean skipNulls,
      StorageType expectedResultType) {
    if (isBinaryOpVectorized(name)) {
      return runVectorizedZip(name, other, problemAggregator);
    } else {
      checkFallback(fallback, expectedResultType, name);
      return zip(fallback, other, skipNulls, expectedResultType, problemAggregator);
    }
  }

  private void checkFallback(Object fallback, StorageType storageType, String operationName)
      throws IllegalArgumentException {
    if (fallback == null) {
      if (operationName == null) {
        throw new IllegalArgumentException(
            "A function or name of vectorized operation must be specified. This is a bug in the"
                + " Table library.");
      } else {
        String className = this.getClass().getName();
        throw new IllegalArgumentException(
            "The operation "
                + operationName
                + " has no vectorized implementation for "
                + className
                + ", but no fallback function was provided. This is a bug in the Table library.");
      }
    }

    if (storageType == null) {
      throw new IllegalArgumentException(
          "The expected result type must be specified if a fallback function is used. This is a bug"
              + " in the Table library.");
    }
  }

  /**
   * Return a new storage, where missing elements have been replaced by arg.
   *
   * @param arg the value to use for missing elements
   * @param commonType the common type of this storage and the provided value
   * @return a new storage, with all missing elements replaced by arg
   */
  public Storage<?> fillMissing(
      Value arg, StorageType commonType, ProblemAggregator problemAggregator) {
    Builder builder = Builder.getForType(commonType, size(), problemAggregator);
    Object convertedFallback = Polyglot_Utils.convertPolyglotValue(arg);
    Context context = Context.getCurrent();
    for (int i = 0; i < size(); i++) {
      Object it = getItemBoxed(i);
      if (it == null) {
        builder.appendNoGrow(convertedFallback);
      } else {
        builder.appendNoGrow(it);
      }

      context.safepoint();
    }

    return builder.seal();
  }

  /**
   * Fills missing values in this storage, by using corresponding values from {@code other}.
   *
   * @param other the source of default values
   * @param commonType a common type that should fit values from both storages
   * @return a new storage with missing values filled
   */
  public Storage<?> fillMissingFrom(
      Storage<?> other, StorageType commonType, ProblemAggregator problemAggregator) {
    var builder = Builder.getForType(commonType, size(), problemAggregator);
    Context context = Context.getCurrent();
    for (int i = 0; i < size(); i++) {
      if (isNa(i)) {
        builder.appendNoGrow(other.getItemBoxed(i));
      } else {
        builder.appendNoGrow(getItemBoxed(i));
      }

      context.safepoint();
    }

    return builder.seal();
  }

  /**
   * Fills missing values with a previous non-missing value.
   *
   * <p>
   *
   * @param missingIndicator Specifies which values should be considered missing. It can be used to
   *     implement custom missing value semantics, like `fill_empty`. It can be set to {@code null}
   *     to just rely on the default semantics of missing values. Some storages may not allow
   *     customizing the semantics.
   */
  public abstract Storage<?> fillMissingFromPrevious(BoolStorage missingIndicator);

  /**
   * Return a new storage, containing only the items marked true in the mask.
   *
   * @param mask the mask to use
   * @param cardinality the number of true values in mask
   * @return a new storage, masked with the given mask
   */
  public abstract Storage<T> mask(BitSet mask, int cardinality);

  /**
   * Returns a new storage, ordered according to the rules specified in a mask.
   *
   * @param mask@return a storage resulting from applying the reordering rules
   */
  public abstract Storage<T> applyMask(OrderMask mask);

  /**
   * @return a copy of the storage containing a slice of the original data
   */
  public abstract Storage<T> slice(int offset, int limit);

  /**
   * @return a new storage instance, containing the same elements as this one, with {@code count}
   *     nulls appended at the end
   */
  public abstract Storage<?> appendNulls(int count);

  /**
   * @return a copy of the storage consisting of slices of the original data
   */
  public abstract Storage<T> slice(List<SliceRange> ranges);

  public List<Object> toList() {
    return new StorageListView(this);
  }

  /**
   * Counts the number of times each value has been seen before in this storage.
   *
   * @return a storage counting the number of times each value in this one has been seen before.
   */
  public Storage<?> duplicateCount() {
    long[] data = new long[size()];
    HashMap<Object, Integer> occurenceCount = new HashMap<>();
    Context context = Context.getCurrent();
    for (int i = 0; i < size(); i++) {
      var value = getItemBoxed(i);
      var count = occurenceCount.getOrDefault(value, 0);
      data[i] = count;
      occurenceCount.put(value, count + 1);
      context.safepoint();
    }
    return new LongStorage(data, IntegerType.INT_64);
  }

  public final Storage<?> cast(
      StorageType targetType, CastProblemAggregator castProblemAggregator) {
    StorageConverter<?> converter = StorageConverter.fromStorageType(targetType);
    return converter.cast(this, castProblemAggregator);
  }
}
