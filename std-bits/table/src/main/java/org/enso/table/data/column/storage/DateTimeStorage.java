package org.enso.table.data.column.storage;

import org.enso.table.data.column.operation.map.MapOpStorage;
import org.enso.table.data.column.operation.map.SpecializedIsInOp;

import java.time.ZonedDateTime;

public final class DateTimeStorage extends SpecializedStorage<ZonedDateTime> {
  /**
   * @param data the underlying data
   * @param size the number of items stored
   */
  public DateTimeStorage(ZonedDateTime[] data, int size) {
    super(data, size, ops);
  }

  private static final MapOpStorage<SpecializedStorage<ZonedDateTime>> ops = buildOps();

  private static MapOpStorage<SpecializedStorage<ZonedDateTime>> buildOps() {
    MapOpStorage<SpecializedStorage<ZonedDateTime>> t = ObjectStorage.buildObjectOps();
    t.add(SpecializedIsInOp.makeForTimeColumns(ZonedDateTime.class));
    return t;
  }

  @Override
  protected SpecializedStorage<ZonedDateTime> newInstance(ZonedDateTime[] data, int size) {
    return new DateTimeStorage(data, size);
  }

  @Override
  protected ZonedDateTime[] newUnderlyingArray(int size) {
    return new ZonedDateTime[size];
  }

  @Override
  public int getType() {
    return Type.DATE_TIME;
  }
}
