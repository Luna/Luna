package org.enso.interpreter.test.builtins;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;

import java.io.ByteArrayOutputStream;
import org.enso.test.utils.ContextUtils;
import org.graalvm.polyglot.Context;
import org.junit.After;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;

public class BuiltinsJavaInteropTest {
  private static Context ctx;
  private static final ByteArrayOutputStream out = new ByteArrayOutputStream();

  @BeforeClass
  public static void prepareCtx() {
    ctx = ContextUtils.createDefaultContext(out);
  }

  @AfterClass
  public static void disposeCtx() {
    ctx.close();
    ctx = null;
  }

  @After
  public void resetOutput() {
    out.reset();
  }

  @Test
  public void javaMethodAcceptsEnsoTimeOfDay_AsObject() {
    var src =
        """
        from Standard.Base import Date_Time
        polyglot java import org.enso.example.PolyglotTestClass

        main =
            dt = Date_Time.now
            PolyglotTestClass.isPolyglotDate_Object dt
        """;
    var result = ContextUtils.evalModule(ctx, src);
    assertThat(result.asBoolean(), is(true));
  }

  @Test
  public void javaMethodAcceptsEnsoTimeOfDay_AsLocalDate() {
    var src =
        """
        from Standard.Base import Date_Time
        polyglot java import org.enso.example.PolyglotTestClass

        main =
            dt = Date_Time.now
            PolyglotTestClass.isPolyglotDate_LocalDate dt
        """;
    var result = ContextUtils.evalModule(ctx, src);
    assertThat(result.asBoolean(), is(true));
  }

  @Test
  public void javaMethodAcceptsEnsoTimeOfDay_AsValue() {
    var src =
        """
        from Standard.Base import Date_Time
        polyglot java import org.enso.example.PolyglotTestClass

        main =
            dt = Date_Time.now
            PolyglotTestClass.isPolyglotDate_Value dt
        """;
    var result = ContextUtils.evalModule(ctx, src);
    assertThat(result.asBoolean(), is(true));
  }
}
