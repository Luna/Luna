package org.enso.base.spi;

import org.enso.base.polyglot.EnsoMeta;
import org.graalvm.polyglot.PolyglotException;
import org.graalvm.polyglot.Value;

import java.util.logging.Logger;

/** A base class for an Enso service backed by an Enso type. */
public abstract class EnsoService {
  private transient Value cachedTypeObject = null;
  private transient boolean wasLoaded = false;

  /**
   * Defines the path of the Enso module that defines the type associated with this SPI
   * registration.
   */
  protected abstract String getModuleName();

  /** Defines the name of the type associated with this SPI registration. */
  protected abstract String getTypeName();

  /**
   * Resolved the Enso type object associated with this SPI registration and returns it as a Value.
   *
   * <p>It may return {@code null} if the Enso library for the associated module is not loaded.
   */
  public final Value getTypeObject() {
    if (!wasLoaded) {
      try {
        cachedTypeObject = EnsoMeta.getType(getModuleName(), getTypeName());
      } catch (PolyglotException e) {
        // Currently I have not found a way to get the type/class of the exception, so we rely on
        // the message.
        boolean isModuleNotLoaded =
            e.getMessage().equals("Module " + getModuleName() + " does not exist.");
        if (isModuleNotLoaded) {
          Logger.getLogger(this.getClass().getCanonicalName())
              .warning(
                  "Failed to instantiate type object for "
                      + this.getClass().getCanonicalName()
                      + ": "
                      + e.getMessage());
          cachedTypeObject = Value.asValue(null);
        } else {
          throw e;
        }
      }

      wasLoaded = true;
    }

    return cachedTypeObject;
  }

  /** Returns whether the Enso library providing the associated type is loaded. */
  public boolean isLoaded() {
    return getTypeObject() != null;
  }

}
