package org.enso.table.data.column.storage;

import org.enso.table.data.column.operation.map.MapOpStorage;
import org.enso.table.data.column.operation.map.MapOperation;
import org.enso.table.data.column.operation.map.UnaryMapOperation;
import org.enso.table.data.index.Index;
import org.enso.table.error.UnexpectedTypeException;

import java.util.BitSet;

/** A boolean column storage. */
public class BoolStorage extends Storage {
  private static final MapOpStorage<BoolStorage> ops = buildOps();
  private final BitSet values;
  private final BitSet isMissing;
  private final int size;
  private final boolean negated;

  public BoolStorage(BitSet values, BitSet isMissing, int size, boolean negated) {
    this.values = values;
    this.isMissing = isMissing;
    this.size = size;
    this.negated = negated;
  }

  @Override
  public int size() {
    return size;
  }

  @Override
  public long getType() {
    return Type.BOOL;
  }

  @Override
  public Object getItemBoxed(int idx) {
    return isMissing.get(idx) ? null : values.get(idx);
  }

  public boolean getItem(long idx) {
    return negated != values.get((int) idx);
  }

  @Override
  public boolean isNa(long idx) {
    return isMissing.get((int) idx);
  }

  @Override
  protected boolean isOpVectorized(String name) {
    return false;
  }

  @Override
  protected Storage runVectorizedMap(String name, Object argument) {
    return null;
  }

  @Override
  protected Storage runVectorizedZip(String name, Storage argument) {
    return null;
  }

  public BitSet getValues() {
    return values;
  }

  public BitSet getIsMissing() {
    return isMissing;
  }

  @Override
  public Storage mask(BitSet mask, int cardinality) {
    BitSet newMissing = new BitSet();
    BitSet newValues = new BitSet();
    int resultIx = 0;
    for (int i = 0; i < size; i++) {
      if (mask.get(i)) {
        if (isMissing.get(i)) {
          newMissing.set(resultIx++);
        } else if (values.get(i)) {
          newValues.set(resultIx++);
        }
      }
    }
    return new BoolStorage(newValues, newMissing, cardinality, negated);
  }

  @Override
  public Storage orderMask(int[] positions) {
    BitSet newNa = new BitSet();
    BitSet newVals = new BitSet();
    for (int i = 0; i < positions.length; i++) {
      if (positions[i] == Index.NOT_FOUND || isMissing.get(positions[i])) {
        newNa.set(i);
      } else if (values.get(positions[i])) {
        values.set(i);
      }
    }
    return new BoolStorage(newVals, newNa, positions.length, negated);
  }

  @Override
  public Storage countMask(int[] counts, int total) {
    BitSet newNa = new BitSet();
    BitSet newVals = new BitSet();
    int pos = 0;
    for (int i = 0; i < counts.length; i++) {
      if (isMissing.get(i)) {
        newNa.set(pos, pos + counts[i]);
      } else if (values.get(i)) {
        newVals.set(pos, pos + counts[i]);
      }
      pos += counts[i];
    }
    return new BoolStorage(newVals, newNa, total, negated);
  }

  public boolean isNegated() {
    return negated;
  }

  private static MapOpStorage<BoolStorage> buildOps() {
    MapOpStorage<BoolStorage> ops = new MapOpStorage<>();
    ops.add(
            new UnaryMapOperation<>("not") {
              @Override
              protected Storage run(BoolStorage storage) {
                return new BoolStorage(
                    storage.values, storage.isMissing, storage.size, !storage.negated);
              }
            })
        .add(
            new MapOperation<>("==") {
              @Override
              public Storage runMap(BoolStorage storage, Object arg) {
                if (arg instanceof Boolean) {
                  if ((Boolean) arg) {
                    return storage;
                  } else {
                    return new BoolStorage(
                        storage.values, storage.isMissing, storage.size, !storage.negated);
                  }
                } else {
                  return new BoolStorage(new BitSet(), storage.isMissing, storage.size, false);
                }
              }

              @Override
              public Storage runZip(BoolStorage storage, Storage arg) {
                BitSet out = new BitSet();
                BitSet missing = new BitSet();
                for (int i = 0; i < storage.size; i++) {
                  if (!storage.isNa(i) && i < arg.size() && !arg.isNa(i)) {
                    if (((Boolean) storage.getItem(i)).equals(arg.getItemBoxed(i))) {
                      out.set(i);
                    }
                  } else {
                    missing.set(i);
                  }
                }
                return new BoolStorage(out, missing, storage.size, false);
              }
            })
        .add(
            new MapOperation<>("&&") {
              @Override
              public Storage runMap(BoolStorage storage, Object arg) {
                if (arg instanceof Boolean) {
                  boolean v = (Boolean) arg;
                  if (v) {
                    return storage;
                  } else {
                    return new BoolStorage(new BitSet(), storage.isMissing, storage.size, false);
                  }
                } else {
                  throw new UnexpectedTypeException("a Boolean");
                }
              }

              @Override
              public Storage runZip(BoolStorage storage, Storage arg) {
                if (arg instanceof BoolStorage) {
                  BoolStorage v = (BoolStorage) arg;
                  BitSet missing = v.isMissing.get(0, storage.size);
                  missing.or(storage.isMissing);
                  BitSet out = v.values.get(0, storage.size);
                  boolean negated;
                  if (storage.negated && v.negated) {
                    out.or(storage.values);
                    negated = true;
                  } else if (storage.negated) {
                    out.andNot(storage.values);
                    negated = false;
                  } else if (v.negated) {
                    out.flip(0, storage.size);
                    out.and(storage.values);
                    negated = false;
                  } else {
                    out.and(storage.values);
                    negated = false;
                  }
                  return new BoolStorage(out, missing, storage.size, negated);
                } else {
                  throw new UnexpectedTypeException("a Boolean column");
                }
              }
            })
        .add(
            new MapOperation<>("||") {
              @Override
              public Storage runMap(BoolStorage storage, Object arg) {
                if (arg instanceof Boolean) {
                  boolean v = (Boolean) arg;
                  if (v) {
                    return new BoolStorage(new BitSet(), storage.isMissing, storage.size, true);
                  } else {
                    return storage;
                  }
                } else {
                  throw new UnexpectedTypeException("a Boolean");
                }
              }

              @Override
              public Storage runZip(BoolStorage storage, Storage arg) {
                if (arg instanceof BoolStorage) {
                  BoolStorage v = (BoolStorage) arg;
                  BitSet missing = v.isMissing.get(0, storage.size);
                  missing.or(storage.isMissing);
                  BitSet out = v.values.get(0, storage.size);
                  boolean negated;
                  if (storage.negated && v.negated) {
                    out.and(storage.values);
                    negated = true;
                  } else if (storage.negated) {
                    out.flip(0, storage.size);
                    out.and(storage.values);
                    negated = true;
                  } else if (v.negated) {
                    out.flip(0, storage.size);
                    out.or(storage.values);
                    negated = false;
                  } else {
                    out.or(storage.values);
                    negated = false;
                  }
                  return new BoolStorage(out, missing, storage.size, negated);
                } else {
                  throw new UnexpectedTypeException("a Boolean column");
                }
              }
            });
    return ops;
  }
}
