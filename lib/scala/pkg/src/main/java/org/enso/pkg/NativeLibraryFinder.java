package org.enso.pkg;

import java.util.Locale;
import org.enso.filesystem.FileSystem;

/**
 * Helper class to find native libraries in packages. The search algorithm complies to the <a
 * href="https://bits.netbeans.org/23/javadoc/org-openide-modules/org/openide/modules/doc-files/api.html#jni">NetBeans
 * JNI specification</a>.
 */
public final class NativeLibraryFinder {

  private NativeLibraryFinder() {}

  /**
   * Tries to find native library in the given package.
   *
   * @param libName the name of the library to find, without platform specific prefix or suffix.
   * @param pkg the package to search in.
   * @return null if not found, absolute path otherwise.
   */
  public static <T> String findNativeLibrary(String libName, Package<T> pkg, FileSystem<T> fs) {
    var arch = System.getProperty("os.arch").toLowerCase(Locale.ENGLISH);
    var osName = simpleOsName();
    var libNameWithSuffix = System.mapLibraryName(libName);
    var libDir = pkg.nativeLibraryDir();
    if (!fs.exists(libDir)) {
      return null;
    }
    var nativeLib = fs.getChild(libDir, libNameWithSuffix);
    if (fs.exists(nativeLib)) {
      return fs.getAbsolutePath(nativeLib);
    }
    nativeLib = fs.getChild(fs.getChild(libDir, arch), libNameWithSuffix);
    if (fs.exists(nativeLib)) {
      return fs.getAbsolutePath(nativeLib);
    }
    nativeLib = fs.getChild(fs.getChild(fs.getChild(libDir, arch), osName), libNameWithSuffix);
    if (fs.exists(nativeLib)) {
      return fs.getAbsolutePath(nativeLib);
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
