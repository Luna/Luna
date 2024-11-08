package org.enso.base.cache;

import java.io.File;
import org.enso.base.CurrentEnsoProject;

public class DiskSpaceGetter extends Mockable<Long> {
  public DiskSpaceGetter() {
      super(() -> getRootPath().getUsableSpace());
  }

  private static File getRootPath() {
    return new File(CurrentEnsoProject.get().getRootPath());
  }
}
