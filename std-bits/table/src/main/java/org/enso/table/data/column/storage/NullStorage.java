package org.enso.table.data.column.storage;

import java.util.BitSet;
import java.util.List;
import org.enso.table.data.column.operation.map.MapOperationProblemAggregator;
import org.enso.table.data.column.storage.type.NullType;
import org.enso.table.data.column.storage.type.StorageType;
import org.enso.table.data.mask.OrderMask;
import org.enso.table.data.mask.SliceRange;

/** A specialized storage that can be used by columns that contain only null values. */
public class NullStorage extends Storage<Void> {
  private final int size;

  public NullStorage(int size) {
    this.size = size;
  }

  @Override
  public int size() {
    return size;
  }

  @Override
  public StorageType getType() {
    return NullType.INSTANCE;
  }

  @Override
  public boolean isNothing(long index) {
    return true;
  }

  @Override
  public Void getItemBoxed(int idx) {
    return null;
  }

  @Override
  public boolean isBinaryOpVectorized(String name) {
    return false;
  }

  @Override
  public Storage<?> runVectorizedBinaryMap(
      String name, Object argument, MapOperationProblemAggregator problemAggregator) {
    throw new IllegalArgumentException("Operation " + name + " is not vectorized for NullStorage");
  }

  @Override
  public Storage<?> runVectorizedZip(
      String name, Storage<?> argument, MapOperationProblemAggregator problemAggregator) {
    throw new IllegalArgumentException("Operation " + name + " is not vectorized for NullStorage");
  }

  @Override
  public Storage<?> fillMissingFromPrevious(BoolStorage missingIndicator) {
    return this;
  }

  @Override
  public Storage<Void> applyFilter(BitSet filterMask, int newLength) {
    return new NullStorage(newLength);
  }

  @Override
  public Storage<Void> applyMask(OrderMask mask) {
    return new NullStorage(mask.length());
  }

  @Override
  public Storage<Void> slice(int offset, int limit) {
    return new NullStorage(limit - offset);
  }

  @Override
  public Storage<?> appendNulls(int count) {
    return new NullStorage(size + count);
  }

  @Override
  public Storage<Void> slice(List<SliceRange> ranges) {
    return new NullStorage(SliceRange.totalLength(ranges));
  }
}
