package org.enso.interpreter.test;

import static org.enso.test.utils.ContextUtils.createDefaultContext;
import static org.enso.test.utils.ContextUtils.executeInContext;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import com.oracle.truffle.api.frame.VirtualFrame;
import org.enso.interpreter.node.expression.builtin.meta.EqualsNode;
import org.enso.interpreter.node.expression.foreign.HostValueToEnsoNode;
import org.enso.interpreter.runtime.data.EnsoMultiValue;
import org.enso.interpreter.runtime.data.Type;
import org.enso.interpreter.runtime.data.text.Text;
import org.enso.test.utils.ContextUtils;
import org.enso.test.utils.TestRootNode;
import org.graalvm.polyglot.Context;
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

  private static boolean equalityCheck(VirtualFrame frame) {
    var args = frame.getArguments();
    return equalsNode.execute(frame, args[0], args[1]).isTrue();
  }

  private boolean equalityCheck(Object first, Object second) {
    return (Boolean) testRootNode.getCallTarget().call(first, second);
  }
}
