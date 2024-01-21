package org.enso.interpreter.node.expression.builtin.interop.syntax;

import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Fallback;
import com.oracle.truffle.api.dsl.GenerateUncached;
import com.oracle.truffle.api.dsl.NeverDefault;
import com.oracle.truffle.api.dsl.ReportPolymorphism;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.library.CachedLibrary;
import com.oracle.truffle.api.nodes.Node;
import org.enso.interpreter.node.expression.foreign.CoerceNothing;
import org.enso.interpreter.runtime.data.text.Text;

/**
 * Converts a value returned by a polyglot call back to a value that can be further used within Enso
 * programs.
 */
@ReportPolymorphism
@GenerateUncached
public abstract class HostValueToEnsoNode extends Node {
  @NeverDefault
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
  Text doChar(char i) {
    return Text.create(Character.toString(i));
  }

  @Specialization
  Text doString(String txt) {
    return Text.create(txt);
  }

  @Specialization(guards = {"o != null", "iop.isNull(o)"})
  Object doNull(
      Object o,
      @CachedLibrary(limit = "3") InteropLibrary iop,
      @Cached CoerceNothing coerceNothing) {
    return coerceNothing.execute(o);
  }

  @Fallback
  Object doOther(Object o) {
    return o;
  }
}
