package org.enso.base.file_system;

import java.util.ServiceLoader;
import org.enso.base.polyglot.EnsoMeta;
import org.graalvm.polyglot.Value;

public abstract class FileSystemSPI {
  private static final ServiceLoader<org.enso.base.file_system.FileSystemSPI> loader =
      ServiceLoader.load(
          org.enso.base.file_system.FileSystemSPI.class,
          org.enso.base.file_format.FileFormatSPI.class.getClassLoader());

  public static Value get_type(String protocol, boolean refresh) {
    if (refresh) {
      loader.reload();
    }

    var first =
        loader.stream()
            .filter(provider -> provider.get().getProtocol().equals(protocol))
            .findFirst();
    return first
        .map(fileSystemSPIProvider -> fileSystemSPIProvider.get().getTypeObject())
        .orElse(null);
  }

  public static Value[] get_types(boolean refresh) {
    if (refresh) {
      loader.reload();
    }
    return loader.stream().map(provider -> provider.get().getTypeObject()).toArray(Value[]::new);
  }

  public Value getTypeObject() {
    return EnsoMeta.getType(getModuleName(), getTypeName());
  }

  protected abstract String getModuleName();

  protected abstract String getTypeName();

  protected abstract String getProtocol();
}
