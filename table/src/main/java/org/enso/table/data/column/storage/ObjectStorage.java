package org.enso.table.data.column.storage;

import org.enso.table.data.column.builder.object.BoolBuilder;
import org.enso.table.data.column.builder.object.Builder;
import org.enso.table.data.column.builder.object.InferredBuilder;
import org.enso.table.data.column.operation.map.MapOpStorage;
import org.enso.table.data.column.operation.map.MapOperation;
import org.enso.table.data.column.operation.map.UnaryMapOperation;
import org.enso.table.data.index.Index;

import java.util.BitSet;
import java.util.function.Function;

/** A column storing arbitrary objects. */
public class ObjectStorage extends Storage {
  private final Object[] data;
  private final int size;
  protected static final MapOpStorage<ObjectStorage> ops = buildOps();

  /**
   * @param data the underlying data
   * @param size the number of items stored
   */
  public ObjectStorage(Object[] data, int size) {
    this.data = data;
    this.size = size;
  }

  /** @inheritDoc */
  @Override
  public int size() {
    return size;
  }

  /**
   * @param idx an index
   * @return the data item contained at the given index.
   */
  public Object getItem(long idx) {
    return data[(int) idx];
  }

  @Override
  public Object getItemBoxed(int idx) {
    return data[idx];
  }

  /** @inheritDoc */
  @Override
  public long getType() {
    return Type.OBJECT;
  }

  /** @inheritDoc */
  @Override
  public boolean isNa(long idx) {
    return data[(int) idx] == null;
  }

  @Override
  protected boolean isOpVectorized(String name) {
    return ops.isSupported(name);
  }

  @Override
  protected Storage runVectorizedMap(String name, Object argument) {
    return ops.runMap(name, this, argument);
  }

  @Override
  protected Storage runVectorizedZip(String name, Storage argument) {
    return ops.runZip(name, this, argument);
  }

  @Override
  public ObjectStorage mask(BitSet mask, int cardinality) {
    Object[] newData = new Object[cardinality];
    int resIx = 0;
    for (int i = 0; i < size; i++) {
      if (mask.get(i)) {
        newData[resIx++] = data[i];
      }
    }
    return new ObjectStorage(newData, cardinality);
  }

  @Override
  public ObjectStorage orderMask(int[] positions) {
    Object[] newData = new Object[positions.length];
    for (int i = 0; i < positions.length; i++) {
      if (positions[i] == Index.NOT_FOUND) {
        newData[i] = null;
      } else {
        newData[i] = data[positions[i]];
      }
    }
    return new ObjectStorage(newData, positions.length);
  }

  @Override
  public ObjectStorage countMask(int[] counts, int total) {
    Object[] newData = new Object[total];
    int pos = 0;
    for (int i = 0; i < counts.length; i++) {
      for (int j = 0; j < counts[i]; j++) {
        newData[pos++] = data[i];
      }
    }
    return new ObjectStorage(newData, total);
  }

  public Object[] getData() {
    return data;
  }

  private static MapOpStorage<ObjectStorage> buildOps() {
    MapOpStorage<ObjectStorage> ops = new MapOpStorage<>();
    ops.add(
        new UnaryMapOperation<>(Ops.IS_MISSING) {
          @Override
          protected Storage run(ObjectStorage storage) {
            BitSet r = new BitSet();
            for (int i = 0; i < storage.size; i++) {
              if (storage.data[i] == null) {
                r.set(i);
              }
            }
            return new BoolStorage(r, new BitSet(), storage.size, false);
          }
        });
    return ops;
  }
}
