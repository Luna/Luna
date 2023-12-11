package org.enso.interpreter.arrow.runtime;

import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.TruffleObject;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import java.nio.ByteBuffer;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;

@ExportLibrary(InteropLibrary.class)
public class ArrowFixedArrayDate64 implements TruffleObject {
  private final long size;
  private final ByteBuffer buffer;
  private static final int elementSize = 8;

  private static final long nanoDiv = 1000000000L;
  private static final ZoneId utc = ZoneId.of("UTC");

  public ArrowFixedArrayDate64(long size) {
    this.size = size;
    this.buffer = ByteBuffer.allocate((int) size * elementSize);
  }

  @ExportMessage
  public boolean hasArrayElements() {
    return true;
  }

  @ExportMessage
  public Object readArrayElement(long index) {
    // TODO: Needs null bitmap
    var secondsPlusNanoSinceEpoch = buffer.getLong((int) index * elementSize);
    var seconds = Math.floorDiv(secondsPlusNanoSinceEpoch, nanoDiv);
    var nano = Math.floorMod(secondsPlusNanoSinceEpoch, nanoDiv);
    var zonedDateTime = Instant.ofEpochSecond(seconds, nano).atZone(utc);
    return new ArrowZonedDate(zonedDateTime);
  }

  @ExportMessage
  public void writeArrayElement(
      long index, Object value, @CachedLibrary(limit = "1") InteropLibrary iop)
      throws UnsupportedMessageException {
    assert iop.isDate(value) && iop.isTime(value);

    var at = index * elementSize;
    if (iop.isTimeZone(value)) {
      var dateTime = iop.asDate(value).atTime(iop.asTime(value)).atZone(iop.asTimeZone(value));
      var zoneDateTime = dateTime.withZoneSameLocal(utc);
      var zoneDateTimeInstant = zoneDateTime.toInstant();
      var secondsPlusNano =
          zoneDateTimeInstant.getEpochSecond() * nanoDiv + zoneDateTimeInstant.getNano();
      buffer.putLong((int) at, secondsPlusNano);
    } else {
      var dateTime = iop.asDate(value).atTime(iop.asTime(value)).toInstant(ZoneOffset.UTC);
      var secondsPlusNano = dateTime.getEpochSecond() * nanoDiv + dateTime.getNano();
      buffer.putLong((int) at, secondsPlusNano);
    }
    // TODO: Update nulls bitmap
  }

  @ExportMessage
  final long getArraySize() {
    return size;
  }

  @ExportMessage
  final boolean isArrayElementReadable(long index) {
    return index >= 0 && index < size;
  }

  @ExportMessage
  final boolean isArrayElementModifiable(long index) {
    return index >= 0 && index < size;
  }

  @ExportMessage
  final boolean isArrayElementInsertable(long index) {
    return index >= 0 && index < size;
  }

  @ExportLibrary(InteropLibrary.class)
  public class ArrowZonedDate implements TruffleObject {
    private ZonedDateTime dateTime;

    public ArrowZonedDate(ZonedDateTime dateTime) {
      this.dateTime = dateTime;
    }

    @ExportMessage
    public boolean isDate() {
      return true;
    }

    @ExportMessage
    public LocalDate asDate() {
      return dateTime.toLocalDate();
    }

    @ExportMessage
    public boolean isTime() {
      return true;
    }

    @ExportMessage
    public LocalTime asTime() {
      return dateTime.toLocalTime();
    }

    @ExportMessage
    public boolean isTimeZone() {
      return true;
    }

    @ExportMessage
    public ZoneId asTimeZone() {
      return dateTime.getZone();
    }
  }
}
