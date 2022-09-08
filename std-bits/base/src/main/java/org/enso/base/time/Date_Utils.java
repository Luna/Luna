package org.enso.base.time;

import java.time.LocalDate;
import java.time.temporal.TemporalAdjuster;

public class Date_Utils implements TimeUtilsBase {
  public static final Date_Utils INSTANCE = new Date_Utils();

  public static LocalDate quarter_start(LocalDate date) {
    return (LocalDate) Date_Period_Utils.quarter_start(date);
  }

  public static LocalDate quarter_end(LocalDate date) {
    return (LocalDate) Date_Period_Utils.quarter_end(date);
  }

  public static LocalDate apply_adjuster(LocalDate date, TemporalAdjuster adjuster) {
    return date.with(adjuster);
  }
}
