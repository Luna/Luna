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
    var osName = simpleOsName();
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

  private static String simpleOsName() {
    var osName = System.getProperty("os.name").toLowerCase(Locale.ENGLISH);
    if (osName.contains(" ")) {
      // Strip version
      osName = osName.substring(0, osName.indexOf(' '));
    }
    if (osName.contains("linux")) {
      return "linux";
    } else if (osName.contains("mac")) {
      return "macos";
    } else if (osName.contains("windows")) {
      return "windows";
    } else {
      throw new IllegalStateException("Unsupported OS: " + osName);
    }
  }
}
