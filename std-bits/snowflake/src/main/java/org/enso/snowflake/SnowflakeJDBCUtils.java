package org.enso.snowflake;

import net.snowflake.client.jdbc.SnowflakeType;
import net.snowflake.client.jdbc.SnowflakeUtil;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

public class SnowflakeJDBCUtils {
  private static final DateTimeFormatter dateTimeFormatter = DateTimeFormatter.ofPattern(SnowflakeType.DATE_OR_TIME_FORMAT_PATTERN);

  public static void setDateTime(PreparedStatement stmt, int columnIndex, ZonedDateTime dateTime, boolean keepOffset) throws SQLException {
    if (keepOffset) {
      stmt.setString(columnIndex, dateTime.format(dateTimeFormatter));
    } else {
      LocalDateTime localDateTime = dateTime.toLocalDateTime();
      Timestamp timestamp = Timestamp.valueOf(localDateTime);
      stmt.setObject(columnIndex, timestamp, SnowflakeUtil.EXTRA_TYPES_TIMESTAMP_NTZ);
    }
  }

  public static void setTimeOfDay(PreparedStatement stmt, int columnIndex, LocalTime timeOfDay) throws SQLException {
    // We use setString instead of setTime, because setTime was losing milliseconds,
    // or with some tricks maybe could have milliseconds but not nanoseconds.
    // With setting as text we can keep the precision.
    stmt.setString(columnIndex, timeOfDay.toString());
  }

  public static void setDate(PreparedStatement stmt, int columnIndex, LocalDate date) throws SQLException {
    stmt.setDate(columnIndex, java.sql.Date.valueOf(date));
  }
}
