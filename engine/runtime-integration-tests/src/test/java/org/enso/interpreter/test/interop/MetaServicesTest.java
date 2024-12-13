package org.enso.interpreter.test.interop;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import java.net.URI;
import org.enso.common.MethodNames;
import org.enso.interpreter.node.callable.InteropApplicationNode;
import org.enso.interpreter.runtime.callable.UnresolvedConversion;
import org.enso.interpreter.runtime.data.Type;
import org.enso.interpreter.runtime.state.State;
import org.enso.test.utils.ContextUtils;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Source;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;

public class MetaServicesTest {
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
  public void loadFileSystemServices() throws Exception {
    final URI uri = new URI("memory://services.enso");
    final Source src =
        Source.newBuilder(
                "enso",
                """
    import Standard.Base.System.File.File_System_SPI
    import Standard.Base.Meta
    import Standard.Base.Enso_Cloud.Enso_File_System_Impl

    fs_spi = File_System_SPI

    data =
        Meta.lookup_services File_System_SPI
    """,
                "services.enso")
            .uri(uri)
            .buildLiteral();

    var module = ctx.eval(src);
    var fileSystemSpi = module.invokeMember(MethodNames.Module.EVAL_EXPRESSION, "fs_spi");
    assertTrue("It is a type: " + fileSystemSpi, fileSystemSpi.isMetaObject());
    var fileSystemSpiRaw = (Type) ContextUtils.unwrapValue(ctx, fileSystemSpi);
    var ensoCtx = ContextUtils.leakContext(ctx);

    for (var p : ensoCtx.getPackageRepository().getLoadedPackagesJava()) {
      p.getConfig()
          .services()
          .foreach(
              pw -> {
                var m =
                    ensoCtx
                        .getTopScope()
                        .getModule("Standard.Base.Enso_Cloud.Enso_File_System_Impl")
                        .get();
                var all = m.getScope().getAllTypes();
                var fsImpl =
                    ContextUtils.executeInContext(
                        ctx,
                        () -> {
                          var conversion = UnresolvedConversion.build(m.getScope());
                          var state = State.create(ensoCtx);
                          var node = InteropApplicationNode.getUncached();
                          for (var t : all) {
                            var fn = conversion.resolveFor(ensoCtx, fileSystemSpiRaw, t);
                            var conv = node.execute(fn, state, new Object[] {fileSystemSpiRaw, t});
                            if (conv != null) {
                              return conv;
                            }
                          }
                          return null;
                        });
                assertNotNull("Some implementation found", fsImpl);
                assertEquals("Protocol", "enso", fsImpl.getMember("protocol").asString());
                assertEquals(
                    "Type",
                    "Standard.Base.Enso_Cloud.Enso_File",
                    fsImpl.getMember("typ").getMetaQualifiedName());
                return null;
              });
    }
  }
}
