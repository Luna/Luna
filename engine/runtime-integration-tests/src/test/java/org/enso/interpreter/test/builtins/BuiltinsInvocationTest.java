package org.enso.interpreter.test.builtins;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;

import org.enso.test.utils.ContextUtils;
import org.graalvm.polyglot.Context;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;

public class BuiltinsInvocationTest {
  private static Context ctx;

  @BeforeClass
  public static void prepareCtx() {
    ctx = ContextUtils.createDefaultContext();
  }

  @AfterClass
  public static void disposeCtx() {
    ctx.close();
    ctx = null;
  }

  @Test
  public void invokeBuiltinWithWrongArguments_ShouldNotCrash() {
    var src =
        """
        from Standard.Base import all

        main =
            Error.catch Any (Error.throw "No longer valid") x->x
        """;
    var res = ContextUtils.evalModule(ctx, src);
    assertThat("Should not crash - should return something", res, is(notNullValue()));
  }
}
