package org.enso.base.cache;

import java.io.File;
import org.enso.base.CurrentEnsoProject;

public class DiskSpaceGetter extends Mockable<long> {
  public DiskSpaceGetter() {
      this(() -> getRootPath().getUsableSpace());
  }

  private static File getRootPath() {
    File(CurrentEnsoProject.get().getRootPath());
  }
}
