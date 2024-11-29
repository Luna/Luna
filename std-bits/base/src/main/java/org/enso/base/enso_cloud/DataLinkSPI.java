package org.enso.base.enso_cloud;

import org.enso.base.spi.AbstractEnsoTypeSPI;
import org.graalvm.polyglot.Value;

/**
 * An interface for data link parser providers. A class providing this interface can register an
 * Enso type that defines how to `parse` a specific type of datalink. The `parse` method on that
 * type should return a configured datalink instance that can later be `read`.
 */
public abstract class DataLinkSPI extends AbstractEnsoTypeSPI {
  private static final class DataLinkTypeLoader extends Loader<DataLinkSPI> {
    public DataLinkTypeLoader() {
      super(DataLinkSPI.class);
    }
  }

  private static final DataLinkTypeLoader loader = new DataLinkTypeLoader();

  public void reload() {
    loader.reload();
  }

  public static Value findDataLinkType(String name) {
    var found =
        loader.findSingleProvider(provider -> name.equals(provider.getLinkTypeName()), name);
    if (found == null) {
      return null;
    }
    return found.getTypeObject();
  }

  /**
   * Defines the name of the data link type associated with this SPI registration.
   *
   * <p>This is the same value as the `type` property of the corresponding variant in
   * `dataLinkSchema.json`.
   */
  protected abstract String getLinkTypeName();
}
