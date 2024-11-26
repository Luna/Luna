package org.enso.base.cache;

import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Value;

/**
 * Detects that the reload button has been pressed.
 *
 * .hasReloadOccurred() returns true if the reload button was pressed since the
 * last call to .hasReloadOccurred().
 * 
 * This uses a weak reference (created in eval'd Enso code) that is set to null
 * on reload.
 *
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
      var module =
          Context.getCurrent()
              .eval(
                  "enso",
                  """
      import Standard.Base.Runtime.Ref.Ref
      import Standard.Base.Data.Boolean.Boolean

      type Trigger
          private Value ref:Ref

          new -> Trigger =
            ref = Ref.new 0 Boolean.True
            Trigger.Value ref

          get self = self.ref.get
      """);
      triggerRef = module.invokeMember("eval_expression", "Trigger.new");
    }
}