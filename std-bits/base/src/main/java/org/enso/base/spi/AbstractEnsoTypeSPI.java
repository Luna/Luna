package org.enso.base.spi;

import org.enso.base.polyglot.EnsoMeta;
import org.graalvm.polyglot.Value;

import java.util.ServiceLoader;
import java.util.function.Predicate;
import java.util.logging.Logger;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public abstract class AbstractEnsoTypeSPI {
  private transient Value cachedTypeObject = null;
  private transient boolean wasLoaded = false;

  /**
   * Defines the path of the Enso module that defines the type associated with this SPI registration.
   */
  protected abstract String getModuleName();

  /**
   * Defines the name of the type associated with this SPI registration.
   */
  protected abstract String getTypeName();

  /**
   * Resolved the Enso type object associated with this SPI registration and returns it as a Value.
   * <p>
   * It may return {@code null} if the Enso library for the associated module is not loaded.
   */
  public final Value getTypeObject() {
    if (!wasLoaded) {
      try {
        cachedTypeObject = EnsoMeta.getType(getModuleName(), getTypeName());
      } catch (Exception e) {
        Logger.getLogger(this.getClass().getCanonicalName()).warning("Failed to instantiate type object for SPI: " + e.getMessage());
        cachedTypeObject = null;
      }

      wasLoaded = true;
    }

    return cachedTypeObject;
  }

  /**
   * Returns whether the Enso library providing the associated type is loaded.
   */
  public boolean isLoaded() {
    return getTypeObject() != null;
  }

  protected static class Loader<T extends AbstractEnsoTypeSPI> {
    private final ServiceLoader<T> loader;

    public Loader(Class<T> clazz) {
      loader = ServiceLoader.load(clazz, clazz.getClassLoader());
    }

    public final void refresh() {
      loader.reload();
    }

    public final Stream<T> getProviders() {
      return loader.stream().map(ServiceLoader.Provider::get).filter(AbstractEnsoTypeSPI::isLoaded);
    }

    public T findSingleProvider(Predicate<T> predicate, String predicateDescription) {
      var found = getProviders().filter(predicate).toList();
      if (found.isEmpty()) {
        return null;
      } else if (found.size() > 1) {
        var modules =
            found.stream()
                .map(AbstractEnsoTypeSPI::getModuleName)
                .collect(Collectors.joining(", "));
        throw new IllegalStateException("Multiple providers found for " + predicateDescription + ". The clashing definitions are in the following modules: " + modules + ".");
      } else {
        return found.get(0);
      }
    }
  }
}
