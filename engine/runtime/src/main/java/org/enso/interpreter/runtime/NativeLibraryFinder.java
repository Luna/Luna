package org.enso.interpreter.runtime;

import com.oracle.truffle.api.TruffleFile;
import java.util.Locale;
import org.enso.pkg.Package;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Helper class to find native libraries in packages. The search algorithm complies to the <a
 * href="https://bits.netbeans.org/23/javadoc/org-openide-modules/org/openide/modules/doc-files/api.html#jni">NetBeans
 * JNI specification</a>.
 */
final class NativeLibraryFinder {

  private static final Logger logger = LoggerFactory.getLogger(NativeLibraryFinder.class);

  private NativeLibraryFinder() {}

  /**
   * Tries to find native library in the given package.
   *
   * @param libName the name of the library to find, without platform specific prefix or suffix.
   * @param pkg the package to search in.
   * @return null if not found, absolute path otherwise.
   */
  static String findNativeLibrary(String libName, Package<TruffleFile> pkg) {
    var arch = System.getProperty("os.arch").toLowerCase(Locale.ENGLISH);
    if (arch.contains(" ")) {
      // Strip version information from the architecture string.
      arch = arch.substring(0, arch.indexOf(' '));
    }
    var osName = System.getProperty("os.name").toLowerCase(Locale.ENGLISH);
    var libNameWithSuffix = System.mapLibraryName(libName);
    var libDir = pkg.polyglotDir().resolve("lib");
    if (!libDir.exists()) {
      logger.trace("Native library directory {} does not exist", libDir);
      return null;
    }
    var nativeLib = libDir.resolve(libNameWithSuffix);
    if (nativeLib.exists()) {
      logger.trace("Found native library {}", nativeLib);
      return nativeLib.getAbsoluteFile().getPath();
    }
    nativeLib = libDir.resolve(arch).resolve(libNameWithSuffix);
    if (nativeLib.exists()) {
      logger.trace("Found native library {}", nativeLib);
      return nativeLib.getAbsoluteFile().getPath();
    }
    nativeLib = libDir.resolve(arch).resolve(osName).resolve(libNameWithSuffix);
    if (nativeLib.exists()) {
      logger.trace("Found native library {}", nativeLib);
      return nativeLib.getAbsoluteFile().getPath();
    }
    return null;
  }
}
