package org.enso.interpreter.test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;

import org.enso.editions.LibraryName;
import org.enso.interpreter.runtime.util.TruffleFileSystem;
import org.enso.pkg.NativeLibraryFinder;
import org.enso.test.utils.ContextUtils;
import org.junit.Test;

public class NativeLibraryFinderTest {
  @Test
  public void standardImageShouldHaveNativeLib() {
    try (var ctx = ContextUtils.createDefaultContext()) {
      // Evaluate dummy sources to force loading Standard.Image
      ContextUtils.evalModule(
          ctx, """
          from Standard.Image import all
          main = 42
          """);
      var ensoCtx = ContextUtils.leakContext(ctx);
      var stdImg =
          ensoCtx
              .getPackageRepository()
              .getPackageForLibraryJava(LibraryName.apply("Standard", "Image"));
      assertThat(stdImg.isPresent(), is(true));
      var nativeLibs =
          NativeLibraryFinder.listAllNativeLibraries(stdImg.get(), TruffleFileSystem.INSTANCE);
      assertThat(
          "There should be just single native lib in Standard.Image", nativeLibs.size(), is(1));
    }
  }
}
