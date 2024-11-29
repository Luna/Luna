package org.enso.base.file_system;

import java.util.List;
import java.util.Objects;
import java.util.ServiceLoader;
import org.enso.base.polyglot.EnsoMeta;
import org.enso.base.spi.AbstractEnsoTypeSPI;
import org.graalvm.polyglot.Value;

public abstract class FileSystemSPI extends AbstractEnsoTypeSPI {

  private final static class FileSystemLoader extends Loader<FileSystemSPI> {
    public FileSystemLoader() {
      super(FileSystemSPI.class);
    }
  }
  private static final FileSystemLoader loader = new FileSystemLoader();

  public static Value get_type(String protocol, boolean refresh) {
    Objects.requireNonNull(protocol, "subType must not be null/Nothing.");

    if (refresh) {
      loader.refresh();
    }

    var found = loader.findSingleProvider(
        provider -> protocol.equals(provider.getProtocol()),
        protocol
    );
    if (found == null) {
      return null;
    }
    return found.getTypeObject();
  }

  public static List<Value> get_types(boolean refresh) {
    if (refresh) {
      loader.refresh();
    }
    return loader.getProviders().map(FileSystemSPI::getTypeObject).toList();
  }

  /**
   * Defines the protocol that this file system provider is responsible for.
   * <p>
   * For example "enso" protocol is used for handling Enso Cloud `enso://` paths.
   */
  protected abstract String getProtocol();
}
