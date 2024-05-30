package org.enso.interpreter.instrument;

import com.oracle.truffle.api.CompilerDirectives;
import java.lang.ref.Reference;
import java.lang.ref.SoftReference;
import java.lang.ref.WeakReference;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Supplier;
import org.enso.interpreter.service.ExecutionService;

/** A storage for computed values. */
public final class RuntimeCache implements java.util.function.Function<String, Object> {
  private final Map<UUID, Reference<Object>> cache = new HashMap<>();
  private final Map<UUID, Reference<Object>> expressions = new HashMap<>();
  private final Map<UUID, String> types = new HashMap<>();
  private final Map<UUID, ExecutionService.FunctionCallInfo> calls = new HashMap<>();
  private Map<UUID, Double> weights = new HashMap<>();
  private Consumer<UUID> observer;

  /**
   * Add value to the cache if it is possible.
   *
   * @param key the key of an entry.
   * @param value the added value.
   * @return {@code true} if the value was added to the cache.
   */
  @CompilerDirectives.TruffleBoundary
  public boolean offer(UUID key, Object value) {
    var weight = weights.get(key);
    if (weight != null && weight > 0) {
      var ref = new SoftReference<>(value);
      cache.put(key, ref);
      expressions.put(key, new WeakReference<>(value));
      return true;
    } else {
      var ref = new WeakReference<>(value);
      expressions.put(key, ref);
      return false;
    }
  }

  /** Get the value from the cache. */
  public Object get(UUID key) {
    var ref = cache.get(key);
    var res = ref != null ? ref.get() : null;
    return res;
  }

  /** Get the value from the cache. */
  public Object getAnyValue(UUID key) {
    var ref = expressions.get(key);
    var res = ref != null ? ref.get() : null;
    return res;
  }

  @Override
  public Object apply(String uuid) {
    var key = UUID.fromString(uuid);
    var ref = expressions.get(key);
    var res = ref != null ? ref.get() : null;
    var callback = observer;
    if (callback != null) {
      callback.accept(key);
    }
    return res;
  }

  /** Remove the value from the cache. */
  public Object remove(UUID key) {
    var ref = cache.remove(key);
    return ref == null ? null : ref.get();
  }

  /**
   * @return all cache keys.
   */
  public Set<UUID> getKeys() {
    return cache.keySet();
  }

  /** Clear the cached values. */
  public void clear() {
    cache.clear();
  }

  /**
   * Cache the type of expression.
   *
   * @return the previously cached type.
   */
  @CompilerDirectives.TruffleBoundary
  public String putType(UUID key, String typeName) {
    return types.put(key, typeName);
  }

  /**
   * @return the cached type of the expression
   */
  @CompilerDirectives.TruffleBoundary
  public String getType(UUID key) {
    return types.get(key);
  }

  /**
   * Cache the function call
   *
   * @param key the expression associated with the function call.
   * @param call the function call.
   * @return the function call that was previously associated with this expression.
   */
  @CompilerDirectives.TruffleBoundary
  public ExecutionService.FunctionCallInfo putCall(
      UUID key, ExecutionService.FunctionCallInfo call) {
    if (call == null) {
      return calls.remove(key);
    }
    return calls.put(key, call);
  }

  /**
   * @return the cached function call associated with the expression.
   */
  @CompilerDirectives.TruffleBoundary
  public ExecutionService.FunctionCallInfo getCall(UUID key) {
    return calls.get(key);
  }

  /**
   * @return the cached method calls.
   */
  public Set<UUID> getCalls() {
    return calls.keySet();
  }

  /**
   * Remove the function call from the cache.
   *
   * @param key the expression associated with the function call.
   */
  public void removeCall(UUID key) {
    calls.remove(key);
  }

  /** Clear the cached calls. */
  public void clearCalls() {
    calls.clear();
  }

  /** Remove the type associated with the provided key. */
  public void removeType(UUID key) {
    types.remove(key);
  }

  /** Clear the cached types. */
  public void clearTypes() {
    types.clear();
  }

  /**
   * @return the weights of this cache.
   */
  public Map<UUID, Double> getWeights() {
    return weights;
  }

  /** Set the new weights. */
  public void setWeights(Map<UUID, Double> weights) {
    this.weights = weights;
  }

  /** Remove the weight associated with the provided key. */
  public void removeWeight(UUID key) {
    weights.remove(key);
  }

  /** Clear the weights. */
  public void clearWeights() {
    weights.clear();
  }

  /**
   * Executes a query while tracking access to the cache by {@code callback} observer.
   *
   * @param callback call with accessed UUIDs
   * @param scope the code to execute
   * @return value computed by the {@code scope}
   * @param <V> type of the returned value
   */
  public <V> V runQuery(Consumer<UUID> callback, Supplier<V> scope) {
    var previousCallback = this.observer;
    this.observer = callback;
    try {
      return scope.get();
    } finally {
      this.observer = previousCallback;
    }
  }
}
