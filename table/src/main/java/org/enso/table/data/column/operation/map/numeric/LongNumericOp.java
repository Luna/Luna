package org.enso.table.data.column.operation.map.numeric;

import org.enso.table.data.column.operation.map.MapOperation;
import org.enso.table.data.column.storage.DoubleStorage;
import org.enso.table.data.column.storage.LongStorage;
import org.enso.table.data.column.storage.Storage;
import org.enso.table.error.UnexpectedTypeException;

public abstract class LongNumericOp extends MapOperation<LongStorage> {
  private final boolean alwaysCast;

  public LongNumericOp(String name, boolean alwaysCast) {
    super(name);
    this.alwaysCast = true;
  }

  public LongNumericOp(String name) {
    this(name, false);
  }

  public abstract double doDouble(long in, double arg);

  public abstract long doLong(long in, long arg);

  @Override
  public Storage run(LongStorage storage, Object arg) {
    if (arg instanceof Long && !alwaysCast) {
      long x = (Long) arg;
      long[] newVals = new long[storage.size()];
      for (int i = 0; i < storage.size(); i++) {
        if (!storage.isNa(i)) {
          newVals[i] = doLong(storage.getItem(i), x);
        }
      }
      return new LongStorage(newVals, newVals.length, storage.getIsMissing());
    } else if (arg instanceof Double || arg instanceof Long) {
      double x = (arg instanceof Double) ? (Double) arg : (Long) arg;
      long[] newVals = new long[storage.size()];
      for (int i = 0; i < storage.size(); i++) {
        if (!storage.isNa(i)) {
          newVals[i] = Double.doubleToRawLongBits(doDouble(storage.getItem(i), x));
        }
      }
      return new DoubleStorage(newVals, newVals.length, storage.getIsMissing());
    }
    throw new UnexpectedTypeException("a Number");
  }
}
