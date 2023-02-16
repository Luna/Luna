package org.enso.interpreter.node.expression.builtin.interop.syntax;

import com.oracle.truffle.api.dsl.*;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.UnsupportedMessageException;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.profiles.ConditionProfile;
import org.enso.interpreter.node.expression.foreign.CoerceNothing;
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.data.text.Text;
import org.enso.interpreter.runtime.error.Warning;
import org.enso.interpreter.runtime.error.WarningsLibrary;
import org.enso.interpreter.runtime.error.WithWarnings;

/**
 * Converts a value returned by a polyglot call back to a value that can be further used within Enso
 * programs.
 */
@ReportPolymorphism
@GenerateUncached
public abstract class HostValueToEnsoNode extends Node {
  public static HostValueToEnsoNode build() {
    return HostValueToEnsoNodeGen.create();
  }

  public static HostValueToEnsoNode getUncached() {
    return HostValueToEnsoNodeGen.getUncached();
  }
  /**
   * Converts an arbitrary value to a value usable within Enso code.
   *
   * @param o the value to convert.
   * @return the Enso counterpart of the value.
   */
  public abstract Object execute(Object o);

  @Specialization
  double doFloat(float f) {
    return f;
  }

  @Specialization
  long doInt(int i) {
    return i;
  }

  @Specialization
  long doShort(short i) {
    return i;
  }

  @Specialization
  long doByte(byte i) {
    return i;
  }

  @Specialization
  long doChar(char i) {
    return i;
  }

  @Specialization
  Text doString(String txt) {
    return Text.create(txt);
  }

  @Specialization(guards = {"o != null", "nulls.isNull(o)"})
  Object doNull(
      Object o,
      @CachedLibrary(limit = "3") InteropLibrary nulls,
      @CachedLibrary(limit = "3") WarningsLibrary warnings,
      @Cached ConditionProfile nullWarningProfile) {
    var nothing = EnsoContext.get(this).getBuiltins().nothing();
    return CoerceNothing.coerceNothing(o, nothing, warnings, nullWarningProfile);
  }

  @Fallback
  Object doOther(Object o) {
    return o;
  }
}
