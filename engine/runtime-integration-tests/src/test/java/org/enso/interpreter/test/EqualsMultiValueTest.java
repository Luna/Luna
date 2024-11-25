package org.enso.interpreter.test;

import static org.enso.test.utils.ContextUtils.createDefaultContext;
import static org.enso.test.utils.ContextUtils.executeInContext;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import com.oracle.truffle.api.frame.VirtualFrame;
import org.enso.common.MethodNames;
import org.enso.interpreter.node.expression.builtin.meta.EqualsNode;
import org.enso.interpreter.node.expression.foreign.HostValueToEnsoNode;
import org.enso.interpreter.runtime.data.EnsoMultiValue;
import org.enso.interpreter.runtime.data.Type;
import org.enso.interpreter.runtime.data.text.Text;
import org.enso.test.utils.ContextUtils;
import org.enso.test.utils.TestRootNode;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Source;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;

public class EqualsMultiValueTest {
  private static Context context;
  private static EqualsNode equalsNode;
  private static TestRootNode testRootNode;
  private static HostValueToEnsoNode hostValueToEnsoNode;

  @BeforeClass
  public static void initContextAndData() {
    context = createDefaultContext();
    executeInContext(
        context,
        () -> {
          testRootNode = new TestRootNode(EqualsMultiValueTest::equalityCheck);
          equalsNode = EqualsNode.create();
          hostValueToEnsoNode = HostValueToEnsoNode.build();
          testRootNode.insertChildren(equalsNode, hostValueToEnsoNode);
          return null;
        });
  }

  @AfterClass
  public static void disposeContext() {
    context.close();
    context = null;
  }

  @Test
  public void testEqualityIntegerAndMultiValue() {
    executeInContext(
        context,
        () -> {
          var builtins = ContextUtils.leakContext(context).getBuiltins();
          var intType = builtins.number().getInteger();
          var textText = builtins.text();
          var fourExtraText =
              EnsoMultiValue.create(
                  new Type[] {intType, textText}, 1, new Object[] {4L, Text.create("Hi")});

          assertTrue("4 == 4t", equalityCheck(4L, fourExtraText));
          assertFalse("5 != 4t", equalityCheck(5L, fourExtraText));
          assertTrue("4t == 4", equalityCheck(fourExtraText, 4L));
          assertFalse("4t != 5", equalityCheck(fourExtraText, 5L));

          return null;
        });
  }

  @Test
  public void testEqualityIntegerAndTextMultiValue() {
    executeInContext(
        context,
        () -> {
          var builtins = ContextUtils.leakContext(context).getBuiltins();
          var intType = builtins.number().getInteger();
          var textText = builtins.text();
          var fourExtraText =
              EnsoMultiValue.create(
                  new Type[] {textText, intType}, 1, new Object[] {Text.create("Hi"), 4L});

          assertFalse("4 != t4", equalityCheck(4L, fourExtraText));
          assertFalse("5 != t4", equalityCheck(5L, fourExtraText));
          assertFalse("t4 != 4", equalityCheck(fourExtraText, 4L));
          assertFalse("4 != t5", equalityCheck(fourExtraText, 5L));

          return null;
        });
  }

  @Test
  public void testEqualityIntegerAndMultiValueWithBoth() {
    executeInContext(
        context,
        () -> {
          var builtins = ContextUtils.leakContext(context).getBuiltins();
          var intType = builtins.number().getInteger();
          var textText = builtins.text();
          var fourExtraText =
              EnsoMultiValue.create(
                  new Type[] {textText, intType}, 2, new Object[] {Text.create("Hi"), 4L});

          assertTrue("4 == 4t", equalityCheck(4L, fourExtraText));
          assertFalse("5 != 4t", equalityCheck(5L, fourExtraText));
          assertTrue("4t == 4", equalityCheck(fourExtraText, 4L));
          assertFalse("4t != 5", equalityCheck(fourExtraText, 5L));

          return null;
        });
  }

  @Test
  public void testEqualityIntegerAndMultiValueWithIntText() {
    executeInContext(
        context,
        () -> {
          var builtins = ContextUtils.leakContext(context).getBuiltins();
          var intType = builtins.number().getInteger();
          var textText = builtins.text();
          var fourExtraText =
              EnsoMultiValue.create(
                  new Type[] {intType, textText}, 2, new Object[] {4L, Text.create("Hi")});

          assertTrue("4 == 4t", equalityCheck(4L, fourExtraText));
          assertFalse("5 != 4t", equalityCheck(5L, fourExtraText));
          assertTrue("4t == 4", equalityCheck(fourExtraText, 4L));
          assertFalse("4t != 5", equalityCheck(fourExtraText, 5L));

          return null;
        });
  }

  @Test
  public void twoMultiValues() {
    executeInContext(
        context,
        () -> {
          var builtins = ContextUtils.leakContext(context).getBuiltins();
          var intType = builtins.number().getInteger();
          var textText = builtins.text();
          var fourExtraText =
              EnsoMultiValue.create(
                  new Type[] {intType, textText}, 1, new Object[] {4L, Text.create("Hi")});
          var fourExtraText2 =
              EnsoMultiValue.create(
                  new Type[] {intType, textText}, 1, new Object[] {4L, Text.create("Hi")});
          var fiveExtraText =
              EnsoMultiValue.create(
                  new Type[] {intType, textText}, 1, new Object[] {5L, Text.create("Hi")});

          assertFalse("!= for sure #1", equalityCheck(fiveExtraText, fourExtraText));
          assertFalse("!= for sure #2", equalityCheck(fourExtraText, fiveExtraText));
          assertTrue("equals #1", equalityCheck(fourExtraText, fourExtraText2));
          assertTrue("equals #2", equalityCheck(fourExtraText2, fourExtraText));

          return null;
        });
  }

  @Test
  public void testEqualityIntegerNoMultiValueWithConversion() throws Exception {
    assertEqualityIntegerWithConversion("c:Complex");
  }

  @Test
  public void testEqualityIntegerAndMultiValueWithConversion() throws Exception {
    assertEqualityIntegerWithConversion("c.as_complex_and_float");
  }

  private void assertEqualityIntegerWithConversion(String complexNew) throws Exception {
    var code =
        """
    import Standard.Base.Data.Numbers.Float
    import Standard.Base.Data.Numbers.Number
    import Standard.Base.Data.Ordering.Comparable
    import Standard.Base.Data.Ordering.Ordering
    import Standard.Base.Nothing
    import Standard.Base.Error.Error
    import Standard.Base.Errors.Illegal_Argument.Illegal_Argument

    ## Sample definition of a complex number with conversions
      from Number and implementation of a comparator.
    type Complex
        private Value re:Float im:Float

        new re=0:Float im=0:Float -> Complex =
            c = Complex.Value re 0
            if im != 0 then c:Complex else
                ${complexNew}

        + self (that:Complex) = Complex.new self.re+that.re self.im+that.im

        < self (that:Complex) = Complex_Comparator.compare self that == Ordering.Less
        > self (that:Complex) = Complex_Comparator.compare self that == Ordering.Greater
        >= self (that:Complex) =
            ordering = Complex_Comparator.compare self that
            ordering == Ordering.Greater || ordering == Ordering.Equal
        <= self (that:Complex) =
            ordering = Complex_Comparator.compare self that
            ordering == Ordering.Less || ordering == Ordering.Equal

    Complex.from (that:Number) = Complex.new that


    Comparable.from (that:Complex) = Comparable.new that Complex_Comparator
    Comparable.from (that:Number) = Comparable.new that Complex_Comparator

    type Complex_Comparator
        compare x:Complex y:Complex = if x.re==y.re && x.im==y.im then Ordering.Equal else
            if x.im==0 && y.im==0 then Ordering.compare x.re y.re else
                Nothing
        hash x:Complex = if x.im == 0 then Ordering.hash x.re else
            7*x.re + 11*x.im

    ## uses the explicit conversion defined in this private module
    Complex.as_complex_and_float self =
        self : Complex&Float

    ## explicit "conversion" of `Complex` to `Float` in a private module
       used in `as_complex_and_float`
    Float.from (that:Complex) =
        if that.im == 0 then that.re else
            Error.throw <| Illegal_Argument.Error "Cannot convert Complex with imaginary part to Float"
    """
            .replace("${complexNew}", complexNew);

    var src = Source.newBuilder("enso", code, "complex.enso").build();
    var complexModule = context.eval(src);
    var complexFourValue =
        complexModule.invokeMember(MethodNames.Module.EVAL_EXPRESSION, "Complex.new 4");

    executeInContext(
        context,
        () -> {
          var complexFour = ContextUtils.unwrapValue(context, complexFourValue);

          assertTrue("4 == 4t", equalityCheck(4L, complexFour));
          assertFalse("5 != 4t", equalityCheck(5L, complexFour));
          assertTrue("4t == 4", equalityCheck(complexFour, 4L));
          assertFalse("4t != 5", equalityCheck(complexFour, 5L));

          return null;
        });
  }

  private static boolean equalityCheck(VirtualFrame frame) {
    var args = frame.getArguments();
    return equalsNode.execute(frame, args[0], args[1]).isTrue();
  }

  private boolean equalityCheck(Object first, Object second) {
    return (Boolean) testRootNode.getCallTarget().call(first, second);
  }
}
