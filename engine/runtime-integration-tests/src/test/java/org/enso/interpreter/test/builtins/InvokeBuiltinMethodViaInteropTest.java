package org.enso.interpreter.test.builtins;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;

import com.oracle.truffle.api.interop.InteropLibrary;
import org.enso.test.utils.ContextUtils;
import org.graalvm.polyglot.Context;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;

/**
 * This test tries to invoke some builtin methods on builtin types via the {@link
 * com.oracle.truffle.api.interop.InteropLibrary interop} protocol.
 */
public class InvokeBuiltinMethodViaInteropTest {
  private static Context ctx;

  @BeforeClass
  public static void setUp() {
    ctx = ContextUtils.createDefaultContext();
  }

  @AfterClass
  public static void tearDown() {
    ctx.close();
    ctx = null;
  }

  @Test
  public void invokeGetMethodOnRef() {
    var code =
        """
        import Standard.Base.Runtime.Ref.Ref

        main = Ref.new 42
        """;
    var ref = ContextUtils.evalModule(ctx, code);
    ContextUtils.executeInContext(
        ctx,
        () -> {
          var interop = InteropLibrary.getUncached();
          var refUnwrapped = ContextUtils.unwrapValue(ctx, ref);
          assertThat(
              "Ref should have a 'get' method",
              interop.isMemberInvocable(refUnwrapped, "get"),
              is(true));
          var res = interop.invokeMember(refUnwrapped, "get");
          assertThat("Ref.get should return a number", interop.isNumber(res), is(true));
          assertThat("Ref.get should return 42", interop.asInt(res), is(42));
          return null;
        });
  }

  /**
   * 'Text.reverse' is an extension method defined outside builtins module scope, so it cannot be
   * resolved.
   */
  @Test
  public void extensionMethodOnBuiltinTypeIsNotResolved() {
    var text = ContextUtils.evalModule(ctx, "main = 'Hello'");
    ContextUtils.executeInContext(
        ctx,
        () -> {
          var interop = InteropLibrary.getUncached();
          var textUnwrapped = ContextUtils.unwrapValue(ctx, text);
          assertThat(
              "Text should not be able to resolve 'reverse' method",
              interop.isMemberInvocable(textUnwrapped, "reverse"),
              is(false));
          return null;
        });
  }

  @Test
  public void invokePlusOnTextWithParameter() {
    var text1 = ContextUtils.evalModule(ctx, "main = 'First'");
    var text2 = ContextUtils.evalModule(ctx, "main = 'Second'");
    ContextUtils.executeInContext(
        ctx,
        () -> {
          var interop = InteropLibrary.getUncached();
          var text1Unwrapped = ContextUtils.unwrapValue(ctx, text1);
          var text2Unwrapped = ContextUtils.unwrapValue(ctx, text2);
          assertThat(
              "Text should have a '+' method",
              interop.isMemberInvocable(text1Unwrapped, "+"),
              is(true));
          var res = interop.invokeMember(text1Unwrapped, "+", text2Unwrapped);
          assertThat("Text.+ should return a text", interop.isString(res), is(true));
          assertThat(
              "Text.+ should return 'FirstSecond'", interop.asString(res), is("FirstSecond"));
          return null;
        });
  }

  /**
   * 'Text.is_empty' is not a builtin method, defined on a builtin type. It should be treated as a
   * builtin method, thus be invocable via interop.
   */
  @Test
  public void invokeNonBuiltinMethodOnBuiltinType() {
    var text = ContextUtils.evalModule(ctx, "main = 'Hello'");
    ContextUtils.executeInContext(
        ctx,
        () -> {
          var interop = InteropLibrary.getUncached();
          var textUnwrapped = ContextUtils.unwrapValue(ctx, text);
          assertThat(
              "Text should have a 'is_empty' method",
              interop.isMemberInvocable(textUnwrapped, "is_empty"),
              is(true));
          var res = interop.invokeMember(textUnwrapped, "is_empty");
          assertThat("Text.is_empty should return a boolean", interop.isBoolean(res), is(true));
          assertThat("Text.is_empty should return false", interop.asBoolean(res), is(false));
          return null;
        });
  }
}
