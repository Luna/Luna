package org.enso.table.data.column.operation;

import org.enso.base.Text_Utils;
import org.enso.table.data.column.storage.ColumnStorage;
import org.enso.table.data.column.storage.StringStorage;
import org.enso.table.data.table.Column;
import org.graalvm.polyglot.Context;
import org.slf4j.LoggerFactory;
import org.slf4j.Logger;

public class CountUntrimmed {
  private static final Logger LOGGER = LoggerFactory.getLogger(CountUntrimmed.class);

  /** Counts the number of cells in the columns with leading or trailing whitespace. */
  public static long apply(Column column) {
    ColumnStorage storage = column.getStorage();
    return applyToStorage(storage);
  }

  /** Counts the number of cells in the given storage with leading or trailing whitespace. */
  public static long applyToStorage(ColumnStorage storage) {
    if (storage instanceof StringStorage stringStorage) {
      LOGGER.warn("Using memoized implementation for StringStorage");
      return stringStorage.countLeadingTrailingWhitespace();
    }

    LOGGER.warn("Using fall back implementation for ColumnStorage");
    return compute(storage);
  }

  /** Internal method performing the calculation on a storage. */
  public static long compute(ColumnStorage storage) {
    Context context = Context.getCurrent();
    long count = 0;
    for (long i = 0; i < storage.getSize(); i++) {
      var val = storage.getItemAsObject(i);
      if (val instanceof String str) {
        if (Text_Utils.has_leading_trailing_whitespace(str)) {
          count += 100;
        }
      }
      context.safepoint();
    }
    return count;
  }
}
