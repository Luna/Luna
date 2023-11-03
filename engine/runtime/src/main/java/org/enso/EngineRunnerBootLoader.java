package org.enso;

import java.net.MalformedURLException;
import java.net.URISyntaxException;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Path;

/**
 * {@code runner.jar} is a fat jar containing all the dependencies for engine-runner, however, it
 * cannot be put on module-path, neither class-path, because it cannot be used in conjunction with
 * {@code runtime.jar} fat jar. For now, this class is a workaround that just tries to invoke {@link
 * org.enso.runner.Main.main} from {@code runner.jar} using a custom class loader that loads classes
 * only from {@code runner.jar}.
 *
 * <p>Note that it is vital that all akka related classes are loaded from {@code runner.jar} and not
 * from {@code runtime.jar}.
 */
public final class EngineRunnerBootLoader {

  private EngineRunnerBootLoader() {}

  private static final String defaultRunnerJar = "runner/runner.jar";

  private static final ClassLoader loader;

  static {
    var ensoRunnerProp = System.getProperty("enso.runner");
    var runnerJarPath =
        ensoRunnerProp != null ? Path.of(ensoRunnerProp) : getDefaultRunnerJarPath();
    if (!runnerJarPath.toFile().exists()) {
      throw new IllegalStateException("Cannot find runner fat jar at " + runnerJarPath);
    }
    URL url;
    try {
      url = runnerJarPath.toUri().toURL();
    } catch (MalformedURLException e) {
      throw new IllegalStateException(e);
    }
    loader = new IsolatedClassLoader(url);
  }

  public static void main(String[] args) throws Exception {
    var clazz = loader.loadClass("org.enso.runner.Main");
    var main = clazz.getMethod("main", String[].class);
    main.invoke(null, (Object) args);
  }

  private static Path getDefaultRunnerJarPath() {
    var runtimeJar =
        EngineRunnerBootLoader.class.getProtectionDomain().getCodeSource().getLocation();
    try {
      var runnerJarUri = runtimeJar.toURI().resolve(defaultRunnerJar);
      return Path.of(runnerJarUri);
    } catch (URISyntaxException e) {
      throw new IllegalStateException(e);
    }
  }

  private static final class IsolatedClassLoader extends URLClassLoader {
    private final ClassLoader systemClassLoader;

    public IsolatedClassLoader(URL runnerJarUrl) {
      super("org.enso.IsolatedClassLoader", new URL[] {runnerJarUrl}, null);
      this.systemClassLoader = ClassLoader.getSystemClassLoader();
    }

    @Override
    public Class<?> loadClass(String name) throws ClassNotFoundException {
      try {
        return super.loadClass(name);
      } catch (ClassNotFoundException ex) {
        if (name.startsWith("org.graalvm.") || name.startsWith("java")) {
          return systemClassLoader.loadClass(name);
        } else {
          throw ex;
        }
      }
    }
  }
}
