package org.enso.pkg.archive;

import java.io.IOException;

/** Base class for errors when building enso-project archive. */
abstract class EnsoProjectArchiveException extends IOException {

  public EnsoProjectArchiveException(IOException cause) {
    super(cause);
  }
}
