package org.enso.interpreter.runtime;

import static scala.jdk.javaapi.CollectionConverters.asJava;

import java.io.File;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.TreeSet;
import org.enso.compiler.core.EnsoParser;
import org.enso.compiler.core.ir.module.scope.imports.Polyglot;
import org.enso.pkg.PackageManager$;
import org.graalvm.nativeimage.hosted.Feature;
import org.graalvm.nativeimage.hosted.RuntimeProxyCreation;
import org.graalvm.nativeimage.hosted.RuntimeReflection;

public final class EnsoLibraryFeature implements Feature {

  /**
   * list of paths to std libs separated by {@link File#pathSeparator}.
   * Points to JAR archives inside {@code polyglot} directories.
   * All the java classes accessed by {@code polyglot java import} will be loaded
   * from these paths. More specifically, from their {@code polyglot} directories.
   */
  private static final String LIB_PATHS = "enso.libs.path";

  private static final List<String> FORCE_LOAD_BY_HOST_LOADER = List.of(
      "nu.pattern.OpenCV"
  );

  @Override
  public void beforeAnalysis(BeforeAnalysisAccess access) {
    var hostClassLoader = new HostClassLoader(access.getApplicationClassLoader());

    var libRoots = new LinkedHashSet<Path>();
    for (var ensoLibPath : getLibPaths()) {
      addClasspath(ensoLibPath, hostClassLoader);
      var libRoot = findLibraryRoot(ensoLibPath);
      if (libRoot != null) {
        libRoots.add(libRoot);
      }
    }

    for (var path : access.getApplicationClassPath()) {
      var libRoot = findLibraryRoot(path);
      if (libRoot != null) {
        libRoots.add(libRoot);
      }
    }


    /*
      To run Standard.Test one shall analyze its polyglot/java files. But there are none
      to include on classpath as necessary test classes are included in Standard.Base!
      We can locate the Test library by following code or we can make sure all necessary
      imports are already mentioned in Standard.Base itself.

    if (!libRoots.isEmpty()) {
      var f = libRoots.iterator().next();
      var stdTest = f.getParent().getParent().resolve("Test").resolve(f.getFileName());
      if (stdTest.toFile().exists()) {
        libRoots.add(stdTest);
      }
      System.err.println("Testing library: " + stdTest);
    }
    */

    var classes = new TreeSet<String>();
    try {
      for (var forceLoadClass : FORCE_LOAD_BY_HOST_LOADER) {
        var clazz = loadClass(forceLoadClass, hostClassLoader);
        System.err.println("Class " + clazz.getName() + " loaded by HostClassLoader");
        classes.add(forceLoadClass);
      }
    } catch (Throwable e) {
      System.err.println("Force loading classes failed:");
      e.printStackTrace(System.err);
      throw new IllegalStateException(e);
    }

    // Loading Java class from packages (from `polyglot java import` statements)
    try {
      for (var p : libRoots) {
        var result = PackageManager$.MODULE$.Default().loadPackage(p.toFile());
        if (result.isSuccess()) {
          var pkg = result.get();
          for (var src : pkg.listSourcesJava()) {
            var code = Files.readString(src.file().toPath());
            var ir = EnsoParser.compile(code);
            for (var imp : asJava(ir.imports())) {
              if (imp instanceof Polyglot poly && poly.entity() instanceof Polyglot.Java entity) {
                var clazz = findClassInNativeImageClasspath(entity.getJavaName(), access);
                if (clazz == null) {
                  clazz = loadClass(entity.getJavaName(), hostClassLoader);
                  System.err.println("Class " + clazz.getName() + " loaded by HostClassLoader");
                }
                classes.add(clazz.getName());
                RuntimeReflection.register(clazz);
                RuntimeReflection.registerAllConstructors(clazz);
                RuntimeReflection.registerAllFields(clazz);
                RuntimeReflection.registerAllMethods(clazz);
                if (clazz.isInterface()) {
                  RuntimeProxyCreation.register(clazz);
                }
                RuntimeReflection.register(clazz.getConstructors());
                RuntimeReflection.register(clazz.getMethods());
                RuntimeReflection.register(clazz.getFields());
              }
            }
          }
        }
      }
    } catch (Throwable ex) {
      ex.printStackTrace(System.err);
      throw new IllegalStateException(ex);
    }
    System.err.println("Summary for polyglot import java:");
    for (var className : classes) {
      System.err.println("  " + className);
    }
    System.err.println("Registered " + classes.size() + " classes for reflection");
  }

  private static void addClasspath(Path path, HostClassLoader hostClassLoader) {
    try {
      var entry = path.toUri().toURL();
      System.err.println("Adding " + entry + " to HostClassLoader classpath");
      hostClassLoader.add(entry);
    } catch (MalformedURLException e) {
      throw new IllegalStateException("No such URL " + path, e);
    }
  }

  private static List<Path> getLibPaths() {
    String pathsProp = System.getProperty(LIB_PATHS);
    if (pathsProp == null) {
      System.err.println("[EnsoLibraryFeature] WARN: " + LIB_PATHS + " is not set");
      return List.of();
    }
    var paths = new ArrayList<Path>();
    for (var path : pathsProp.split(File.pathSeparator)) {
      var p = Path.of(path);
      if (!p.toFile().isFile()) {
        throw new IllegalStateException("Not a file: " + p);
      }
      paths.add(p);
    }
    return paths;
  }

  private static Path findLibraryRoot(Path file) {
    var p1 = file.getParent();
    if (p1 != null && p1.getFileName().toString().equals("java")) {
      var p2 = p1.getParent();
      if (p2 != null
          && p2.getFileName().toString().equals("polyglot")
          && p2.getParent() != null) {
        return p2.getParent();
      }
    }
    return null;
  }

  private static Class<?> loadClass(String name, HostClassLoader hostClassLoader) {
    var nameBuilder = new StringBuilder(name);
    Class<?> clazz = null;
    while (true) {
      var currentName = nameBuilder.toString();
      try {
        clazz = hostClassLoader.loadClass(currentName);
      } catch (ClassNotFoundException e) {
        // nop
      }
      if (clazz != null) {
        return clazz;
      }
      int at = currentName.lastIndexOf('.');
      if (at < 0) {
        throw new IllegalStateException("Cannot load class " + name);
      }
      nameBuilder.setCharAt(at, '$');
    }
  }

  private static Class<?> findClassInNativeImageClasspath(String name, BeforeAnalysisAccess access) {
    var nameBuilder = new StringBuilder(name);
    Class<?> clazz;
    while (true) {
      var currentName = nameBuilder.toString();
      clazz = access.findClassByName(currentName);
      if (clazz != null) {
        return clazz;
      }
      int at = currentName.lastIndexOf('.');
      if (at < 0) {
        return null;
      }
      nameBuilder.setCharAt(at, '$');
    }
  }
}
