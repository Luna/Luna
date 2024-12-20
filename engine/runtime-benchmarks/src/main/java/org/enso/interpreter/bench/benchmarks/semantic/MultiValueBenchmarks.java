package org.enso.interpreter.bench.benchmarks.semantic;

import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import org.enso.compiler.benchmarks.Utils;
import org.graalvm.polyglot.Value;
import org.openjdk.jmh.annotations.Benchmark;
import org.openjdk.jmh.annotations.BenchmarkMode;
import org.openjdk.jmh.annotations.Fork;
import org.openjdk.jmh.annotations.Measurement;
import org.openjdk.jmh.annotations.Mode;
import org.openjdk.jmh.annotations.OutputTimeUnit;
import org.openjdk.jmh.annotations.Scope;
import org.openjdk.jmh.annotations.Setup;
import org.openjdk.jmh.annotations.State;
import org.openjdk.jmh.annotations.Warmup;
import org.openjdk.jmh.infra.BenchmarkParams;
import org.openjdk.jmh.infra.Blackhole;

/**
 * These benchmarks compare performance of {@link EnsoMultiValue}. They create a vector in a certain
 * configuration representing numbers and then they perform {@code sum} operation on it.
 */
@BenchmarkMode(Mode.AverageTime)
@Fork(1)
@Warmup(iterations = 3)
@Measurement(iterations = 5)
@OutputTimeUnit(TimeUnit.MILLISECONDS)
@State(Scope.Benchmark)
public class MultiValueBenchmarks {
  private Value arrayOfNumbers;
  private Value sum;
  private Value self;
  private final long length = 100000;

  @Setup
  public void initializeBenchmark(BenchmarkParams params) throws Exception {
    var ctx = Utils.createDefaultContextBuilder().build();
    var code =
        """
        from Standard.Base import Vector, Float, Number, Integer

        type Complex
            private Number re:Float im:Float

        Complex.from (that:Number) = Complex.Number that 0

        sum arr =
            go acc i = if i >= arr.length then acc else
                v = arr.at i : Float
                sum = acc + v
                @Tail_Call go sum i+1
            go 0 0


        make_vector type n =
            Vector.new n i->
                r = 3 + 5*i
                case type of
                    0 -> r:Integer
                    1 -> r:Float
                    2 -> r:Complex
                    3 ->
                        c = r:Complex&Float
                        c:Float
                    4 ->
                        c = r:Float&Complex
                        c:Float
                    5 -> r:Complex&Float
                    6 -> r:Float&Complex
        """;
    var benchmarkName = SrcUtil.findName(params);
    var src = SrcUtil.source(benchmarkName, code);
    var module = ctx.eval(src);

    this.self = module.invokeMember("get_associated_type");
    Function<String, Value> getMethod = (name) -> module.invokeMember("get_method", self, name);

    String test_builder;
    int type = Integer.parseInt(benchmarkName.substring(benchmarkName.length() - 1));
    this.arrayOfNumbers = getMethod.apply("make_vector").execute(self, type, length);
    this.sum = getMethod.apply("sum");
  }

  @Benchmark
  public void sumOverInteger0(Blackhole matter) {
    performBenchmark(matter);
  }

  @Benchmark
  public void sumOverFloat1(Blackhole matter) {
    performBenchmark(matter);
  }

  @Benchmark
  public void sumOverComplexCast2(Blackhole matter) {
    performBenchmark(matter);
  }

  @Benchmark
  public void sumOverComplexFloatRecastedToFloat3(Blackhole matter) {
    performBenchmark(matter);
  }

  @Benchmark
  public void sumOverFloatComplexRecastedToFloat4(Blackhole matter) {
    performBenchmark(matter);
  }

  @Benchmark
  public void sumOverComplexAndFloat5(Blackhole matter) {
    performBenchmark(matter);
  }

  @Benchmark
  public void sumOverFloatAndComplex6(Blackhole matter) {
    performBenchmark(matter);
  }

  private void performBenchmark(Blackhole matter) throws AssertionError {
    var resultValue = sum.execute(self, arrayOfNumbers);
    if (!resultValue.fitsInLong()) {
      throw new AssertionError("Shall be a long: " + resultValue);
    }
    long result = resultValue.asLong();
    long expectedResult = length * 3L + (5L * (length * (length - 1L) / 2L));
    boolean isResultCorrect = result == expectedResult;
    if (!isResultCorrect) {
      throw new AssertionError("Expecting " + expectedResult + " but was " + result);
    }
    matter.consume(result);
  }
}
