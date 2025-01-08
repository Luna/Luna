package org.enso.interpreter.runtime.data;

import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.CompilerDirectives.TruffleBoundary;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.zone.ZoneRulesException;
import org.enso.interpreter.dsl.Builtin;
import org.enso.interpreter.runtime.builtin.BuiltinObject;
import org.enso.interpreter.runtime.data.text.Text;
import org.enso.polyglot.common_utils.Core_Date_Utils;

@ExportLibrary(InteropLibrary.class)
@Builtin(
    pkg = "date",
    name = EnsoTimeZone.builtinName,
    stdlibName = "Standard.Base.Data.Time.Time_Zone.Time_Zone")
public final class EnsoTimeZone extends BuiltinObject {

  private final ZoneId zone;

  public EnsoTimeZone(ZoneId zone) {
    this.zone = zone;
  }

  @Override
  protected String builtinName() {
    return "Time_Zone";
  }

  @Builtin.Method(description = "Get the unique identifier for your system's current timezone.")
  @CompilerDirectives.TruffleBoundary
  public Text zoneId() {
    return Text.create(this.zone.getId());
  }

  @Builtin.Method(description = "Get offset in seconds of this zone at given time")
  @CompilerDirectives.TruffleBoundary
  public long offset(Object at) {
    try {
      var iop = InteropLibrary.getUncached();
      var d = iop.asDate(at);
      var t = iop.asTime(at);
      return zone.getRules().getOffset(d.atTime(t)).getTotalSeconds();
    } catch (UnsupportedMessageException ex) {
      return 0;
    }
  }

  @Builtin.Method(
      name = "parse_builtin",
      description = "Parse the ID producing a Time_Zone.",
      autoRegister = false)
  @Builtin.Specialize
  @Builtin.WrapException(from = ZoneRulesException.class)
  @CompilerDirectives.TruffleBoundary
  public static EnsoTimeZone parse(String text) {
    return new EnsoTimeZone(ZoneId.of(text));
  }

  @Builtin.Method(
      name = "new_builtin",
      description =
          "Obtains an instance of `Time_Zone` using an offset in hours, minutes and seconds from"
              + " the UTC zone.",
      autoRegister = false)
  @Builtin.WrapException(from = DateTimeException.class)
  @CompilerDirectives.TruffleBoundary
  public static EnsoTimeZone create(long hours, long minutes, long seconds) {
    return new EnsoTimeZone(
        ZoneOffset.ofHoursMinutesSeconds(
            Math.toIntExact(hours), Math.toIntExact(minutes), Math.toIntExact(seconds)));
  }

  @Builtin.Method(
      name = "system",
      description = "The system default timezone.",
      autoRegister = false)
  @CompilerDirectives.TruffleBoundary
  public static EnsoTimeZone system() {
    return new EnsoTimeZone(Core_Date_Utils.defaultSystemZone());
  }

  @ExportMessage
  @Override
  @TruffleBoundary
  public String toDisplayString(boolean ignoreSideEffects) {
    return zone.toString();
  }

  @ExportMessage
  boolean isTimeZone() {
    return true;
  }

  @ExportMessage
  ZoneId asTimeZone() {
    return zone;
  }
}
