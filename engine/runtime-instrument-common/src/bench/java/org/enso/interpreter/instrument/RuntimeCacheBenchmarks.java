package org.enso.interpreter.bench.benchmarks;

import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.enso.interpreter.instrument.RuntimeCache;
import org.openjdk.jmh.annotations.*;
import org.openjdk.jmh.runner.Runner;
import org.openjdk.jmh.runner.RunnerException;
import org.openjdk.jmh.runner.options.Options;
import org.openjdk.jmh.runner.options.OptionsBuilder;

@BenchmarkMode(Mode.AverageTime)
@Fork(1)
@Warmup(iterations = 5)
@Measurement(iterations = 5)
@OutputTimeUnit(TimeUnit.MICROSECONDS)
@State(Scope.Benchmark)
public class RuntimeCacheBenchmarks {

  private final RuntimeCache cache = new RuntimeCache();
  private int index = 0;
  private UUID[] keys;

  @Param({"1000000"})
  public int items;

  @State(Scope.Thread)
  @AuxCounters(AuxCounters.Type.EVENTS)
  public static class CacheCounters {

    private long hits = 0;
    private long misses = 0;

    public double hitRatio() {
      return ((double) hits) / (hits + misses);
    }

    public void putHit() {
      hits++;
    }

    public void putMiss() {
      misses++;
    }
  }

  public UUID nextKey() {
    if (index == keys.length) {
      index = 0;
    }
    UUID key = keys[index];
    index++;
    return key;
  }

  @Setup
  public void setup() {
    keys = new UUID[items];
    for (int i = 0; i < items; i++) {
      keys[i] = UUID.randomUUID();
      cache.offer(keys[i], new Object());
    }
  }

  @Benchmark
  public void benchCacheGet(CacheCounters counters) {
    Object result = cache.get(nextKey());
    if (result == null) {
      counters.putMiss();
    } else {
      counters.putHit();
    }
  }

  public static void main(String[] args) throws RunnerException {
    Options opt =
        new OptionsBuilder().include(RuntimeCacheBenchmarks.class.getSimpleName()).build();

    new Runner(opt).run();
  }
}
