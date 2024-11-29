package org.enso.base.file_format;

import java.util.List;
import java.util.Objects;
import org.enso.base.spi.AbstractEnsoTypeSPI;
import org.graalvm.polyglot.Value;

public abstract class FileFormatSPI extends AbstractEnsoTypeSPI {

  private static final FileFormatLoader loader = new FileFormatLoader();

  public static List<Value> get_types(boolean refresh) {
    if (refresh) {
      loader.reload();
    }
    return loader.getProviders().stream().map(AbstractEnsoTypeSPI::getTypeObject).toList();
  }

  public static Value findFormatForDataLinkSubType(String subType) {
    Objects.requireNonNull(subType, "subType must not be null/Nothing.");

    var found =
        loader.findSingleProvider(
            provider -> subType.equalsIgnoreCase(provider.getDataLinkFormatName()), subType);
    if (found == null) {
      return null;
    }
    return found.getTypeObject();
  }

  private static final class FileFormatLoader extends Loader<FileFormatSPI> {
    public FileFormatLoader() {
      super(FileFormatSPI.class);
    }
  }

  /**
   * An optional method that allows this format to be parsed as a selected format in data-links.
   *
   * <p>If a format overrides this method to return a non-null format name (corresponding to the
   * "subType" field in a data-link format entry, see `dataLinkSchema.json` for more details), then
   * the corresponding Enso type should provide a `from` conversion, which will be able to construct
   * a configured format instance from its JSON representation (which should be consistent with the
   * schema).
   */
  protected String getDataLinkFormatName() {
    return null;
  }
}
