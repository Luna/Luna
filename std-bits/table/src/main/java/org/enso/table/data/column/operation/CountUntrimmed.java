package org.enso.table.data.column.operation;

import org.enso.base.Text_Utils;
import org.enso.table.data.column.storage.ColumnStorage;
import org.enso.table.data.column.storage.StringStorage;
import org.enso.table.data.table.Column;
import org.graalvm.polyglot.Context;

public class CountUntrimmed {
  /** Counts the number of cells in the columns with leading or trailing whitespace. */
  public static long apply(Column column) {
    ColumnStorage storage = column.getStorage();
    return applyToStorage(storage);
  }

  /** Counts the number of cells in the given storage with leading or trailing whitespace. */
  public static long applyToStorage(ColumnStorage storage) {
    if (storage instanceof StringStorage stringStorage) {
      return stringStorage.countLeadingTrailingWhitespace();
    }
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
          count++;
        }
      }
      context.safepoint();
    }
    return count;
  }
}
