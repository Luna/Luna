package org.enso.table.data.column.storage.type;

public record NullType() implements StorageType {
  public static final NullType INSTANCE = new NullType();

  @Override
  public boolean isNumeric() {
    // TODO ?
    return false;
  }

  @Override
  public boolean hasDate() {
    // TODO ?
    return false;
  }

  @Override
  public boolean hasTime() {
    // TODO ?
    return false;
  }
}
