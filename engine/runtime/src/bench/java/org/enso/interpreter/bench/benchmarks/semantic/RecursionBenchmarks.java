package org.enso.interpreter.bench.benchmarks.semantic;

import java.math.BigInteger;
import java.util.concurrent.TimeUnit;
import org.enso.interpreter.bench.fixtures.semantic.RecursionFixtures;
import org.enso.interpreter.test.DefaultInterpreterRunner;
import org.openjdk.jmh.annotations.Benchmark;
import org.openjdk.jmh.annotations.BenchmarkMode;
import org.openjdk.jmh.annotations.Fork;
import org.openjdk.jmh.annotations.Measurement;
import org.openjdk.jmh.annotations.Mode;
import org.openjdk.jmh.annotations.OutputTimeUnit;
import org.openjdk.jmh.annotations.Warmup;

@BenchmarkMode(Mode.AverageTime)
@Fork(1)
@Warmup(iterations = 5)
@Measurement(iterations = 5)
@OutputTimeUnit(TimeUnit.MILLISECONDS)
public class RecursionBenchmarks {
  private static RecursionFixtures recursionFixtures = new RecursionFixtures();

  private void runOnHundredMillion(DefaultInterpreterRunner.MainMethod main) {
    main.mainFunction().value().execute(main.mainConstructor(), recursionFixtures.hundredMillion());
  }

  private static final long hundredMil = 100000000;

  public long javaNormal() {
    long res = 0;
    for (long i = 0; i < hundredMil; i++) {
      res += i;
    }
    return res;
  }

  public long javaExact() {
    long res = 0;
    for (long i = 0; i < hundredMil; i = Math.addExact(i, 1)) {
      res = Math.addExact(res, i);
    }
    return res;
  }

  public BigInteger javaBig() {
    BigInteger res = BigInteger.valueOf(0);
    BigInteger one = BigInteger.valueOf(1);
    BigInteger million = BigInteger.valueOf(1000000);
    for (BigInteger i = BigInteger.valueOf(0); i.compareTo(million) < 0; i = i.add(one)) {
      res = res.add(one);
    }
    return res;
  }

  @Benchmark
  public void benchJavaBig() {
    javaBig();
  }

  @Benchmark
  public void benchSumTCO() {
    runOnHundredMillion(recursionFixtures.sumTCO());
  }

  @Benchmark
  public void benchSumTCOWithEval() {
    runOnHundredMillion(recursionFixtures.sumTCOWithEval());
  }

  @Benchmark
  public void benchSumTCOFoldLike() {
    runOnHundredMillion(recursionFixtures.sumTCOFoldLike());
  }

  @Benchmark
  public void benchSumRecursive() {
    DefaultInterpreterRunner.MainMethod main = recursionFixtures.sumRecursive();
    main.mainFunction().value().execute(main.mainConstructor(), recursionFixtures.hundred());
  }

  @Benchmark
  public void benchOversaturatedRecursiveCall() {
    runOnHundredMillion(recursionFixtures.oversaturatedRecursiveCall());
  }

  @Benchmark
  public void benchSumStateTCO() {
    runOnHundredMillion(recursionFixtures.sumStateTCO());
  }

  @Benchmark
  public void benchNestedThunkSum() {
    runOnHundredMillion(recursionFixtures.nestedThunkSum());
  }
}
