package org.enso.compiler.core.ir;

import org.enso.persistance.Persistable;

@Persistable(clazz=Location.class, id=1)
public record Location(int start, int end) {
  public int length() {
    return end - start;
  }
}
