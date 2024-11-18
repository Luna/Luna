package org.enso.interpreter.runtime;

import java.lang.ref.Reference;
import java.lang.ref.ReferenceQueue;
import java.lang.ref.SoftReference;
import java.lang.ref.WeakReference;
import java.util.Collection;
import java.util.concurrent.ConcurrentLinkedQueue;

/** Tracks soft and weak references and allow their cleanup. */
public final class ReferencesManager {
  private final EnsoContext ctx;
  private final Collection<Reference> refs = new ConcurrentLinkedQueue<>();
  private final ReferenceQueue<Object> queue = new ReferenceQueue<>();

  ReferencesManager(EnsoContext ctx) {
    this.ctx = ctx;
  }

  /**
   * Creates new reference to provided object and registers it in the manager.
   *
   * @param <T> class of the object to reference
   * @param obj the object to reference
   * @param type ({@code 1} use {@link SoftReference} or {@code 2} to use {@link WeakReference}
   * @return newly created reference to the provided object
   */
  public <T> Reference<T> create(T obj, int type) {
    clearPendingReferences();
    var r =
        switch (type) {
          case 1 -> new SoftReference<>(obj, queue);
          case 2 -> new WeakReference<>(obj, queue);
          default -> throw new IllegalStateException();
        };
    refs.add(r);
    return r;
  }

  /** Releases all the references. E.g. cleans all the cached values. */
  public void releaseAll() {
    var arr = refs.toArray(Reference[]::new);
    for (var r : arr) {
      r.clear();
      refs.remove(r);
    }
  }

  private void clearPendingReferences() {
    for (; ; ) {
      var r = queue.poll();
      if (r == null) {
        break;
      }
      refs.remove(r);
    }
  }
}
