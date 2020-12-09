package org.enso.table.data.column.operation.map;

import org.enso.table.data.column.storage.Storage;

import java.util.HashMap;
import java.util.Map;

public class MapOpStorage<T extends Storage> {
  private final Map<String, MapOperation<T>> ops = new HashMap<>();

  public boolean isSupported(String n) {
    return ops.get(n) != null;
  }

  public Storage runMap(String n, T storage, Object arg) {
    return ops.get(n).runMap(storage, arg);
  }

  public Storage runZip(String n, T storage, Storage arg) {
    return ops.get(n).runZip(storage, arg);
  }

  public MapOpStorage<T> add(MapOperation<T> op) {
    ops.put(op.getName(), op);
    return this;
  }
}
