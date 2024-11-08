package org.enso.base.cache;

import java.util.Optional;
import java.util.function.Supplier;

public class Mockable<T> {
  private Supplier<T> supplier;
  private Optional<T> override = Optional.empty();

  public Mockable(Supplier<T> supplier) {
    this.supplier = supplier;
  }

  public void mocked(T t) {
    this.override = Optional.of(t);
  }

  public void unmocked() {
    this.override = Optional.empty();
  }

  public T get() {
    return override.orElse(supplier.get());
  }
}
