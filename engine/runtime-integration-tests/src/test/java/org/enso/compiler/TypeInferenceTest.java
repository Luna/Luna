package org.enso.compiler;

import org.enso.interpreter.test.TestBase;
import org.enso.polyglot.RuntimeOptions;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Source;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;

import java.io.OutputStream;
import java.net.URI;

public class TypeInferenceTest extends TestBase {
  private static Context ctx;

  @BeforeClass
  public static void prepareCtx() {
    ctx =
        defaultContextBuilder()
            .option(RuntimeOptions.ENABLE_TYPE_CHECK, "true")
//            .out(OutputStream.nullOutputStream())
//            .err(OutputStream.nullOutputStream())
            .build();
  }

  @AfterClass
  public static void disposeCtx() {
    ctx.close();
  }

  @Test
  public void zeroAryCheck() throws Exception {
    final URI uri = new URI("memory://zeroAryCheck.enso");
    final Source src =
        Source.newBuilder("enso", """
                from Standard.Base import Integer
                    
                const -> Integer = 42
                    
                foo =
                    x = const
                    y = 42
                    x
                    
                bar =
                    y = foo
                    y
                """, uri.getAuthority())
            .uri(uri)
            .buildLiteral();

    var module = ctx.eval(src);
    // TODO can we get compiler to fire without eval??
    module.invokeMember("eval_expression", "bar");
    // TODO checking what is inferred
  }

  @Test
  public void functionReturnCheck() throws Exception {
    final URI uri = new URI("memory://functionReturnCheck.enso");
    final Source src =
        Source.newBuilder("enso", """
                from Standard.Base import Integer
                    
                add x y -> Integer = x+y
                    
                foo z =
                    a = 42
                    b = add a z
                    b
                """, uri.getAuthority())
            .uri(uri)
            .buildLiteral();

    var module = ctx.eval(src);
    // TODO checking what is inferred
  }
}
