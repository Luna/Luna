package org.enso.interpreter.bench.benchmarks.semantic;

import java.io.ByteArrayOutputStream;
import java.nio.file.Paths;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Engine;
import org.graalvm.polyglot.Value;
import org.openjdk.jmh.annotations.*;
import org.openjdk.jmh.infra.BenchmarkParams;
import org.openjdk.jmh.infra.Blackhole;

/**
 * These benchmarks compare performance of ArrayProxy generating its values ad-hoc versus a vector
 * of pregenerated values. It assumes a very simple generation algorithm (like would be used to
 * generate Range.to_vector for example), as obviously with a costly generation logic access will
 * definitely not be faster than a memory-cached approach.
 */
@BenchmarkMode(Mode.AverageTime)
@Fork(1)
@Warmup(iterations = 3)
@Measurement(iterations = 5)
@OutputTimeUnit(TimeUnit.MILLISECONDS)
@State(Scope.Benchmark)
public class ArrayProxyBenchmarks {
  private Value arrayOfNumbers;
  private Value sum;
  private Value self;
  private final long length = 100000;

  @Setup
  public void initializeBenchmark(BenchmarkParams params) {
    Engine eng =
        Engine.newBuilder()
            .allowExperimentalOptions(true)
            .logHandler(new ByteArrayOutputStream())
            .option(
                "enso.languageHomeOverride",
                Paths.get("../../distribution/component").toFile().getAbsolutePath())
            .build();
    var ctx = Context.newBuilder().engine(eng).allowIO(true).allowAllAccess(true).build();
    var module =
        ctx.eval(
            "enso",
            """
                import Standard.Base.Data.Vector
                from Standard.Base.Data.Array_Proxy import Array_Proxy
                sum arr =
                    go acc i = if i == arr.length then acc else
                        @Tail_Call go (acc + arr.at i) i+1
                    sum 0 0
                
                make_vector n =
                    Vector.new n (i -> 3 + 5*i)
                make_proxy n =
                    Array_Proxy.new n (i -> 3 + 5*i)
                make_proxied_vector n =
                    Vector.from_polyglot_array (make_proxy n)
                """);

    this.self = module.invokeMember("get_associated_type");
    Function<String, Value> getMethod = (name) -> module.invokeMember("get_method", self, name);

    String test_builder =
        switch (params.getBenchmark().replaceFirst(".*\\.", "")) {
          case "sumOverVector" -> "make_vector";
          case "sumOverArrayProxy" -> "make_proxy";
          case "sumOverVectorBackedByProxy" -> "make_proxied_vector";
          default -> throw new IllegalStateException(
              "Unexpected benchmark: " + params.getBenchmark());
        };
    this.arrayOfNumbers = getMethod.apply(test_builder).execute(self, length);
    this.sum = getMethod.apply("sum");
  }

  @Benchmark
  public void sumOverVector(Blackhole matter) {
    performBenchmark(matter);
  }

  @Benchmark
  public void sumOverArrayProxy(Blackhole matter) {
    performBenchmark(matter);
  }

  @Benchmark
  public void sumOverVectorBackedByProxy(Blackhole matter) {
    performBenchmark(matter);
  }

  private void performBenchmark(Blackhole matter) throws AssertionError {
    var resultValue = sum.execute(self, arrayOfNumbers);
    if (!resultValue.fitsInLong()) {
      throw new AssertionError("Shall be a long: " + resultValue);
    }
    long result = resultValue.asLong();
    long expectedResult = length * 3 + (5 * (length * (length + 1) / 2));
    boolean isResultCorrect = result == expectedResult;
    if (!isResultCorrect) {
      throw new AssertionError(
          "Expecting reasonable average but was " + result + "\n" + arrayOfNumbers);
    }
    matter.consume(result);
  }
}
