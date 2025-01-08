package org.enso.table.data.column.operation;

import java.util.Random;

import org.enso.base.Text_Utils;
import org.enso.table.data.column.storage.ColumnStorage;
import org.enso.table.data.column.storage.StringStorage;
import org.enso.table.data.table.Column;
import org.graalvm.polyglot.Context;

public class CountNonTrivialWhitespace {
  // Default seed for random number generation (no specific reason for this value, just stability on
  // result).

  private static final long RANDOM_SEED = 672716252;

  // Default sample size for counting cells that contain non trivial whitespace.
  public static final long DEFAULT_SAMPLE_SIZE = 10000;

  /** Counts the number of cells in the columns with non trivial whitespace */
  public static Long apply(Column column, long sampleSize) throws InterruptedException {
    ColumnStorage storage = column.getStorage();
    return applyToStorage(storage, sampleSize);
  }

  /** Counts the number of cells in the given storage with non trivial whitespace */
  public static Long applyToStorage(ColumnStorage storage, long sampleSize)
      throws InterruptedException {
    return (sampleSize == DEFAULT_SAMPLE_SIZE && storage instanceof StringStorage stringStorage)
        ? stringStorage.cachedWhitespaceCount()
        : (Long) compute(storage, sampleSize, Context.getCurrent());
  }

  /** Internal method performing the calculation on a storage. */
  public static long compute(ColumnStorage storage, long sampleSize, Context context) {
    long size = storage.getSize();

    long count = 0;
    if (sampleSize < size) {
      var rng = new Random(RANDOM_SEED);
      for (int i = 0; i < sampleSize; i++) {
        long idx = rng.nextInt(Math.toIntExact(size));
        var val = storage.getItemAsObject(idx);
        if (val instanceof String str && Text_Utils.has_non_trivial_whitespace(str)) {
          count++;
        }

        if (context != null) {
          context.safepoint();
        }
      }
      count = Math.min(size, (long) Math.ceil((double) count / sampleSize * size));
    } else {
      for (long i = 0; i < storage.getSize(); i++) {
        var val = storage.getItemAsObject(i);
        if (val instanceof String str && Text_Utils.has_non_trivial_whitespace(str)) {
          count++;
        }

        if (context != null) {
          context.safepoint();
        }
      }
    }

    return count;
  }
}
