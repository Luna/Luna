package org.enso.runner;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import org.enso.distribution.DistributionManager;
import org.enso.distribution.Environment;
import org.enso.runtimeversionmanager.components.GraalVMVersion;
import org.enso.runtimeversionmanager.components.GraalVersionManager;
import org.enso.version.BuildVersion;

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

  /**
   * Tries to find {@code java} executable in the distribution runtime with the same version that
   * was used for building.
   *
   * @return null if not found.
   */
  private static Path findJavaExecutableInDistributionRuntimes() {
    var env = new Environment() {};
    var distributionManager = new DistributionManager(env);
    var graalVersionManager = new GraalVersionManager(distributionManager, env);
    var graalVersionUsedForBuild =
        new GraalVMVersion(BuildVersion.graalVersion(), BuildVersion.javaVersion());
    var runtime = graalVersionManager.findGraalRuntime(graalVersionUsedForBuild);
    if (runtime != null) {
      return runtime.javaExecutable();
    } else {
      return null;
    }
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
