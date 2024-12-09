package org.enso.table.operations;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.enso.base.text.TextFoldingStrategy;
import org.enso.table.data.column.storage.Storage;
import org.enso.table.data.column.storage.numeric.LongStorage;
import org.enso.table.data.column.storage.type.IntegerType;
import org.enso.table.data.index.MultiValueIndex;
import org.enso.table.data.index.OrderedMultiValueKey;
import org.enso.table.data.index.UnorderedMultiValueKey;
import org.enso.table.data.table.Column;
import org.enso.table.problems.ColumnAggregatedProblemAggregator;
import org.enso.table.problems.ProblemAggregator;
import org.enso.table.util.ConstantList;

public class AddGroupNumber {
  public static Storage<?> numberGroups(
      GroupingMethod groupingMethod,
      long start,
      long step,
      Column[] groupingColumns,
      Column[] orderingColumns,
      int[] directions,
      ProblemAggregator problemAggregator) {
    var groupNumberIterator = new StepIterator(start, step);
    return switch (groupingMethod) {
        case Unique -> numberGroupsUnique(groupNumberIterator, groupingColumns, problemAggregator);
        case Equal_Count -> numberGroupsUnique(groupNumberIterator, groupingColumns, problemAggregator);
    };
  }

  public static Storage<?> numberGroupsUnique(
      StepIterator stepIterator,
      Column[] groupingColumns,
      ProblemAggregator problemAggregator) {
    if (groupingColumns.length == 0) {
      throw new IllegalArgumentException("At least one grouping column is required.");
    }

    int numRows = groupingColumns[0].getSize();

    long[] numbers = new long[numRows];

    Storage<?>[] groupingStorages =
        Arrays.stream(groupingColumns).map(Column::getStorage).toArray(Storage[]::new);
    ColumnAggregatedProblemAggregator groupingProblemAggregator = new ColumnAggregatedProblemAggregator(problemAggregator);
    List<TextFoldingStrategy> textFoldingStrategy =
        ConstantList.make(TextFoldingStrategy.unicodeNormalizedFold, groupingStorages.length);
    Map<UnorderedMultiValueKey, Long> groupNumbers = new HashMap<>();

    for (int i = 0; i < numRows; i++) {
      var key = new UnorderedMultiValueKey(groupingStorages, i, textFoldingStrategy);
      key.checkAndReportFloatingEquality(
          groupingProblemAggregator, columnIx -> groupingColumns[columnIx].getName());
      var groupNumber = groupNumbers.computeIfAbsent(key, k -> stepIterator.next());
      numbers[i] = groupNumber;
    }

    return new LongStorage(numbers, IntegerType.INT_64);
  }

  private static class StepIterator {
    private final long step;
    private long current;

    public StepIterator(long start, long step) {
        this.step = step;

        this.current = start;
    }

    public long next() {
        current += step;
        return current;
    }
  }

  public enum GroupingMethod {
    Unique,
    Equal_Count
  }
}