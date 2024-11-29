package org.enso.table.data.column.operation;

import java.util.Random;
import org.enso.base.Text_Utils;
import org.enso.table.data.column.storage.ColumnStorage;
import org.enso.table.data.column.storage.StringStorage;
import org.enso.table.data.table.Column;
import org.graalvm.polyglot.Context;

public class CountUntrimmed {
  // Default seed for random number generation (no specific reason for this value, just stability on
  // result).
  private static final long RANDOM_SEED = 677280131;

  // Default sample size for counting untrimmed cells.
  public static final long DEFAULT_SAMPLE_SIZE = 10000;

  /** Counts the number of cells in the columns with leading or trailing whitespace. */
  public static long apply(Column column, long sampleSize) {
    ColumnStorage storage = column.getStorage();
    return applyToStorage(storage, sampleSize);
  }

  /** Counts the number of cells in the given storage with leading or trailing whitespace. */
  public static long applyToStorage(ColumnStorage storage, long sampleSize) {
    return (sampleSize == DEFAULT_SAMPLE_SIZE && storage instanceof StringStorage stringStorage)
        ? stringStorage.countUntrimmed()
        : compute(storage, sampleSize);
  }

  /** Internal method performing the calculation on a storage. */
  public static long compute(ColumnStorage storage, long sampleSize) {
    long size = storage.getSize();
    boolean sample = sampleSize < size;
    Random rng = sample ? new Random(RANDOM_SEED) : null;
    double sampleRate = sample ? (double) sampleSize / size : 1.0;

    Context context = Context.getCurrent();
    long count = 0;
    for (long i = 0; i < storage.getSize(); i++) {
      if (sample && rng.nextDouble() > sampleRate) {
        continue;
      }

      var val = storage.getItemAsObject(i);
      if (val instanceof String str) {
        if (Text_Utils.has_leading_trailing_whitespace(str)) {
          count++;
        }
      }
      context.safepoint();
    }

    if (sample) {
      count = Math.min(size, (long) Math.ceil((double) count / sampleRate));
    }
    return count;
  }
}
