package org.enso.runner;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import org.enso.distribution.DistributionManager;
import org.enso.distribution.Environment;

/** Utility class that tries to find installed JDK on the system. */
final class JavaFinder {
  private JavaFinder() {}

  /**
   * Tries to find {@code java} executable on the system. If a system-wide JDK is not found, tries
   * to find it in the {@link DistributionManager distribution} runtimes.
   *
   * @return null if cannot be found. Otherwise, returns the absolute path to the executable, or
   *     simply {@code java} if it is on the {@code PATH}.
   */
  static String findJavaExecutable() {
    var javaHome = System.getenv("JAVA_HOME");
    if (javaHome != null) {
      var java = new File(javaHome, "bin/java").getAbsoluteFile();
      if (java.exists()) {
        return java.getAbsolutePath();
      }
    }
    if (isJavaOnPath()) {
      return "java";
    }
    var javaInRuntime = findJavaExecutableInDistributionRuntimes();
    if (javaInRuntime != null) {
      return javaInRuntime.toAbsolutePath().toString();
    }
    return null;
  }

  private static Path findJavaExecutableInDistributionRuntimes() {
    var env = new Environment() {};
    var dm = new DistributionManager(env);
    var paths = dm.paths();
    var files = paths.runtimes().toFile().listFiles();
    if (files != null) {
      for (var d : files) {
        var java = new File(new File(d, "bin"), "java").getAbsoluteFile();
        if (java.exists()) {
          return java.toPath();
        }
      }
    }
    return null;
  }

  private static boolean isJavaOnPath() {
    try {
      ProcessBuilder processBuilder = new ProcessBuilder("java", "-h");
      Process process = processBuilder.start();
      int exitCode = process.waitFor();
      return exitCode == 0;
    } catch (IOException | InterruptedException e) {
      return false;
    }
  }
}
