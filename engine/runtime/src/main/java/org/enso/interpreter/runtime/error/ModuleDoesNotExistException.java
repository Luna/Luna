package org.enso.interpreter.runtime.error;

import com.oracle.truffle.api.exception.AbstractTruffleException;

/** Thrown when a module was requested for importing but could not be found. */
public class ModuleDoesNotExistException extends AbstractTruffleException {
  /**
   * Creates a new instance of this error.
   *
   * @param name the qualified name of the non-existent module
   */
  public ModuleDoesNotExistException(String name) {
    super("Module " + name + " does not exist.");
  }
}
