package org.enso.base.cache;

import java.time.ZonedDateTime;

public class NowGetter extends Mockable<ZonedDateTime> {
  public NowGetter() {
    super(() -> ZonedDateTime.now());
  }

  /**
   * This is necessary because a direct call to the superclass does not convert a polyglot Value to
   * ZonedDateTime.
   */
  @Override
  public void mocked(ZonedDateTime dt) {
    super.mocked(dt);
  }
}
