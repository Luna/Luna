package org.enso.compiler;

import java.io.File;
import java.io.IOException;
import java.util.Optional;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.enso.pkg.Package;
import org.enso.pkg.QualifiedName;

public final class PackageRepositoryUtils {
  private static final Logger LOG = Logger.getLogger(PackageRepositoryUtils.class.getName());

  private PackageRepositoryUtils() {}

  /**
   * Fetches the module name associated with a given file, using the environment packages
   * information.
   *
   * @param packageRepository repository to work on
   * @param file the path to decode.
   * @return a qualified name of the module corresponding to the file, if exists.
   */
  public static Optional<QualifiedName> getModuleNameForFile(
      PackageRepository packageRepository, File file) {
    return scala.jdk.javaapi.CollectionConverters.asJava(packageRepository.getLoadedPackages())
        .stream()
        .filter(pkg -> file.getPath().startsWith(pkg.sourceDir().getPath()))
        .map(pkg -> pkg.moduleNameForFile(file))
        .findFirst();
  }

  /**
   * Finds the package the provided module belongs to.
   *
   * @param packageRepository repository to work on
   * @param file the module to find the package of
   * @return {@code module}'s package, if exists
   */
  public static Optional<Package<File>> getPackageOf(
      PackageRepository packageRepository, File file) {
    try {
      if (file != null) {
        file = file.getCanonicalFile();
        for (var pkg : packageRepository.getLoadedPackagesJava()) {
          if (file.getPath().startsWith(pkg.root().getCanonicalFile().getPath())) {
            return Optional.of(pkg);
          }
        }
      }
    } catch (IOException e) {
      LOG.log(Level.WARNING, null, e);
    }
    return Optional.empty();
  }
}
