package org.enso.base.cache;

import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Value;

/**
 * Detects that the reload button has been pressed.
 *
 * <p>.hasReloadOccurred() returns true if the reload button was pressed since the last call to
 * .hasReloadOccurred().
 *
 * <p>This uses a weak reference (created in eval'd Enso code) that is set to null on reload.
 */
public class ReloadDetector {
  // Weak reference that is set to null on reload.
  private Value triggerRef;

  public ReloadDetector() {
    resetTriggerRef();
  }

  public boolean hasReloadOccurred() {
    var reloadHasOccurred = triggerRef.invokeMember("get").isNull();
    if (reloadHasOccurred) {
      resetTriggerRef();
    }
    return reloadHasOccurred;
  }

  private void resetTriggerRef() {
    // The `0` value stored in the reference is not used; it just has to
    // something other than null.
    var module =
        Context.getCurrent()
            .eval(
                "enso",
                """
      import Standard.Base.Runtime.Ref.Ref
      import Standard.Base.Data.Boolean.Boolean
      import Standard.Base.Nothing.Nothing

      type Trigger
          private Value ref:Ref

          new -> Trigger =
            ref = Ref.new 0 Boolean.True
            Trigger.Value ref

          get self = self.ref.get

          clear self = self.ref.put Nothing
      """);
    triggerRef = module.invokeMember("eval_expression", "Trigger.new");
  }

  void simulateReloadTestOnly() {
    triggerRef.invokeMember("clear");
  }
}
