package org.enso.base.file_system;

import java.util.List;
import java.util.Objects;
import org.enso.base.spi.EnsoService;
import org.enso.base.spi.EnsoServiceLoader;
import org.graalvm.polyglot.Value;

public abstract class FileSystemSPI extends EnsoService {

  private static final class FileSystemLoader extends EnsoServiceLoader<FileSystemSPI> {
    public FileSystemLoader() {
      super(FileSystemSPI.class);
    }
  }

  private static final FileSystemLoader loader = new FileSystemLoader();

  public static Value get_type(String protocol, boolean refresh) {
    Objects.requireNonNull(protocol, "protocol must not be null/Nothing.");

    if (refresh) {
      loader.reload();
    }

    var found =
        loader.findSingleProvider(provider -> protocol.equals(provider.getProtocol()), protocol);
    if (found == null) {
      return null;
    }
    return found.getTypeObject();
  }

  public static List<Value> get_types(boolean refresh) {
    if (refresh) {
      loader.reload();
    }
    return loader.getProviders().stream().map(FileSystemSPI::getTypeObject).toList();
  }

  /**
   * Defines the protocol that this file system provider is responsible for.
   *
   * <p>For example "enso" protocol is used for handling Enso Cloud `enso://` paths.
   */
  protected abstract String getProtocol();
}
