package org.enso.interpreter.test.builtins;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;

import com.oracle.truffle.api.interop.InteropLibrary;
import org.enso.interpreter.node.callable.InvokeMethodNode;
import org.enso.interpreter.node.callable.dispatch.InvokeFunctionNode;
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.data.atom.AtomNewInstanceNode;
import org.enso.interpreter.test.ValuesGenerator;
import org.enso.interpreter.test.ValuesGenerator.Language;
import org.enso.test.utils.ContextUtils;
import org.graalvm.polyglot.Context;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;

public class BuiltinsExposeMethodsTest {
  private static Context ctx;
  private static EnsoContext ensoCtx;
  private static ValuesGenerator valuesGenerator;

  @BeforeClass
  public static void initCtx() {
    ctx = ContextUtils.createDefaultContext();
    ensoCtx = ContextUtils.leakContext(ctx);
    valuesGenerator = ValuesGenerator.create(ctx, Language.ENSO);
  }

  @AfterClass
  public static void disposeCtx() {
    ctx.close();
    ctx = null;
    ensoCtx = null;
    valuesGenerator.dispose();
    valuesGenerator = null;
  }

  @Test
  public void booleanExportsMethods() {
    var src = """
        import Standard.Base.Runtime.Ref.Ref
        main =
            Ref.new 0
        """;
    var ref = ContextUtils.evalModule(ctx, src);
    assertThat("'get' member is invocable",
        ref.canInvokeMember("get"), is(true));
  }
}
