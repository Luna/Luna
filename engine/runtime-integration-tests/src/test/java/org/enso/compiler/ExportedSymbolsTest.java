package org.enso.compiler;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.instanceOf;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.enso.compiler.context.CompilerContext.Module;
import org.enso.compiler.data.BindingsMap;
import org.enso.pkg.QualifiedName;
import org.enso.polyglot.PolyglotContext;
import org.enso.polyglot.RuntimeOptions;
import org.enso.test.utils.ContextUtils;
import org.enso.test.utils.ProjectUtils;
import org.enso.test.utils.SourceModule;
import org.graalvm.polyglot.Context;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import scala.jdk.javaapi.CollectionConverters;

public class ExportedSymbolsTest {
  private Path projDir;

  @Before
  public void setup() throws IOException {
    this.projDir = Files.createTempDirectory("exported-symbols-test");
  }

  @After
  public void tearDown() throws IOException {
    ProjectUtils.deleteRecursively(projDir);
  }

  @Test
  public void exportedSymbolsFromSingleModule() throws IOException {
    var mainSrcMod =
        new SourceModule(QualifiedName.fromString("Main"), """
        type A_Type
        """);
    ProjectUtils.createProject("Proj", Set.of(mainSrcMod), projDir);
    var ctx = createCtx(projDir);
    compile(ctx);
    var mainExportedSymbols = getExportedSymbolsFromModule(ctx, "local.Proj.Main");
    assertThat(mainExportedSymbols.size(), is(1));
    assertThat(mainExportedSymbols.containsKey("A_Type"), is(true));
    assertThat(
        mainExportedSymbols.get("A_Type").get(0), instanceOf(BindingsMap.ResolvedType.class));
  }

  @Test
  public void transitivelyExportedSymbols() throws IOException {
    var aMod =
        new SourceModule(QualifiedName.fromString("A_Module"), """
        type A_Type
        """);
    var mainSrcMod =
        new SourceModule(
            QualifiedName.fromString("Main"),
            """
        export project.A_Module.A_Type
        type B_Type
        """);
    ProjectUtils.createProject("Proj", Set.of(aMod, mainSrcMod), projDir);
    var ctx = createCtx(projDir);
    compile(ctx);
    var mainExportedSymbols = getExportedSymbolsFromModule(ctx, "local.Proj.Main");
    assertThat(mainExportedSymbols.size(), is(2));
    assertThat(mainExportedSymbols.keySet(), containsInAnyOrder("A_Type", "B_Type"));
  }

  @Test
  public void exportSymbolFromDifferentModule() throws IOException {
    var aMod =
        new SourceModule(QualifiedName.fromString("A_Module"), """
        from project.B_Module export B_Type
        type A_Type
        """);
    var bMod =
        new SourceModule(QualifiedName.fromString("B_Module"), """
        type B_Type
        """);
    ProjectUtils.createProject("Proj", Set.of(aMod, bMod), projDir);
    var ctx = createCtx(projDir);
    compile(ctx);
    var aModExportedSymbols = getExportedSymbolsFromModule(ctx, "local.Proj.A_Module");
    assertThat(aModExportedSymbols.size(), is(2));
    assertThat(aModExportedSymbols.keySet(), containsInAnyOrder("A_Type", "B_Type"));
  }

  private static Context createCtx(Path projDir) {
    return ContextUtils.defaultContextBuilder()
        .option(RuntimeOptions.PROJECT_ROOT, projDir.toAbsolutePath().toString())
        .build();
  }

  private static void compile(Context ctx) {
    new PolyglotContext(ctx).getTopScope().compile(true);
  }

  private static Map<String, List<BindingsMap.ResolvedName>> getExportedSymbolsFromModule(
      Context ctx, String modName) {
    var ensoCtx = ContextUtils.leakContext(ctx);
    var mod = ensoCtx.getPackageRepository().getLoadedModule(modName).get();
    return getExportedSymbols(mod);
  }

  private static Map<String, List<BindingsMap.ResolvedName>> getExportedSymbols(Module module) {
    var bindings = new HashMap<String, List<BindingsMap.ResolvedName>>();
    var bindingsScala = module.getBindingsMap().exportedSymbols();
    bindingsScala.foreach(
        entry -> {
          var symbol = entry._1;
          var resolvedNames = CollectionConverters.asJava(entry._2.toSeq());
          bindings.put(symbol, resolvedNames);
          return null;
        });
    return bindings;
  }
}
