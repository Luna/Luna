package org.enso.interpreter.node.expression.builtin.runtime;

import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.nodes.Node;
import org.enso.interpreter.dsl.BuiltinMethod;
import org.enso.interpreter.runtime.EnsoContext;

@BuiltinMethod(
    type = "Runtime",
    name = "release_references",
    description = "Releases registered references",
    autoRegister = false)
public abstract class ReleaseReferencesNode extends Node {

  public abstract Object execute();

  /**
   * @return A new ReleaseReferencesNode.
   */
  public static ReleaseReferencesNode build() {
    return ReleaseReferencesNodeGen.create();
  }

  @Specialization
  Object doReleaseReferences() {
    releaseReferences();
    return EnsoContext.get(this).getBuiltins().nothing();
  }

  @CompilerDirectives.TruffleBoundary
  private void releaseReferences() {
    EnsoContext.get(this).getReferencesManager().releaseAll();
  }
}
