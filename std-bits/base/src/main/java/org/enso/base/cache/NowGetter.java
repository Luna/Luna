package org.enso.base.cache;

import java.time.ZonedDateTime;

public class NowGetter extends Mockable<ZonedDateTime> {
    public NowGetter() {
        this(() -> ZonedDateTime.now());
    }
}
