package org.enso.interpreter.node.expression.builtin.meta;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import com.oracle.truffle.api.interop.TruffleObject;
import java.util.ArrayList;
import org.enso.interpreter.runtime.callable.UnresolvedConstructor;
import org.enso.interpreter.runtime.callable.UnresolvedSymbol;
import org.enso.interpreter.runtime.data.EnsoMultiValue;
import org.enso.interpreter.runtime.data.Type;
import org.enso.interpreter.runtime.error.DataflowError;
import org.enso.interpreter.runtime.library.dispatch.TypeOfNode;
import org.enso.interpreter.test.ValuesGenerator;
import org.enso.test.utils.ContextUtils;
import org.enso.test.utils.TestRootNode;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Value;
import org.junit.AfterClass;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;

@RunWith(Parameterized.class)
public class TypeOfNodeMultiValueTest {
  @Parameterized.Parameter(0)
  public Object value;

  @Parameterized.Parameter(1)
  public String type;

  private static Context ctx;

  private static Context ctx() {
    if (ctx == null) {
      ctx = ContextUtils.defaultContextBuilder().build();
    }
    return ctx;
  }

  @Parameterized.Parameters
  public static Object[][] allPossibleEnsoInterpreterValues() throws Exception {
    var g = ValuesGenerator.create(ctx());
    var typeOf =
        ContextUtils.evalModule(
            ctx(),
            """
    from Standard.Base import all

    typ obj = Meta.type_of obj
    main = typ
    """);
    var data = new ArrayList<Object[]>();
    for (var polyValue : g.allValues()) {
      registerValue(typeOf, polyValue, data);
    }
    data.add(new Object[] {UnresolvedSymbol.build("unknown_name", null), "Function"});
    data.add(new Object[] {UnresolvedConstructor.build(null, "Unknown_Name"), "Function"});
    return data.toArray(new Object[0][]);
  }

  private static void registerValue(Value typeOf, Value polyValue, ArrayList<Object[]> data) {
    var t = typeOf.execute(polyValue);
    if (!polyValue.isNull()) {
      assertTrue("Type of " + polyValue + " is " + t, t.isMetaObject());
      var rawValue = ContextUtils.unwrapValue(ctx(), polyValue);
      var rawType = ContextUtils.unwrapValue(ctx(), t);
      if (rawType instanceof Type type) {
        var multi = EnsoMultiValue.create(new Type[] {type}, new Object[] {rawValue});
        var n = t.getMetaSimpleName();
        data.add(new Object[] {multi, n});
      } else {
        if (!t.isHostObject()) {
          data.add(new Object[] {rawValue, null});
        }
      }
    }
  }

  @AfterClass
  public static void disposeCtx() throws Exception {
    if (ctx != null) {
      ctx.close();
      ctx = null;
    }
  }

  @Test
  public void typeOfCheck() {
    assertType(value, type, false);
  }

  @Test
  public void typeOfCheckAfterPriming() {
    assertType(value, type, true);
  }

  private static void assertType(Object value, String expectedTypeName, boolean withPriming) {
    assertNotNull("Value " + value + " should have a type", expectedTypeName);
    ContextUtils.executeInContext(
        ctx(),
        () -> {
          var node = TypeOfNode.create();
          var root =
              new TestRootNode(
                  (frame) -> {
                    var arg = frame.getArguments()[0];
                    var t = node.findTypeOrError(arg);
                    var all = node.findAllTypes(arg);
                    if (t instanceof DataflowError) {
                      assertNull("No types for errors", all);
                    } else {
                      assertNotNull("All types found for " + value, all);
                      assertEquals("Size is one", 1, all.length);
                      assertEquals("Same type for " + value, t, all[0]);
                    }
                    return t;
                  });
          root.insertChildren(node);
          var call = root.getCallTarget();

          if (withPriming) {
            class ForeignObject implements TruffleObject {}
            var foreignType = call.call(new ForeignObject());
            assertTrue(
                "Empty foreign is unknown: " + foreignType, foreignType instanceof DataflowError);
          }
          var symbolType = call.call(value);
          var symbolTypeValue = ctx.asValue(symbolType);
          assertTrue("It is meta object: " + symbolTypeValue, symbolTypeValue.isMetaObject());
          assertEquals(expectedTypeName, symbolTypeValue.getMetaSimpleName());
          return null;
        });
  }
}
