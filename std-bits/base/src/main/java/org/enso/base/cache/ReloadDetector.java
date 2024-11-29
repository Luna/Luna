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
  private Value trigger;

  public ReloadDetector() {
    resetTrigger();
  }

  public boolean hasReloadOccurred() {
    var reloadHasOccurred = trigger.invokeMember("get").isNull();
    if (reloadHasOccurred) {
      resetTrigger();
    }
    return reloadHasOccurred;
  }

  private void resetTrigger() {
    // The `on_finalize` function and the `clear` method both write `Nothing` to
    // the ref. This is a signal that a reload has happenend. `on_finalize` is
    // called by the engine when a reload happens. `clear` is only for testing,
    // to simulate a reload.
    //
    // The `0` value stored in the ref is not used; it just has to be something
    // other than Nothing.
    var module =
        Context.getCurrent()
            .eval(
                "enso",
                """
      import Standard.Base.Data.Boolean.Boolean
      import Standard.Base.Nothing.Nothing
      import Standard.Base.Runtime.Managed_Resource.Managed_Resource

      type Trigger
          private Value mr:Managed_Resource

          new -> Trigger =
            ref = Ref.new 0
            on_finalize ref = ref.put Nothing
            mr = Managed_Resource.register ref on_finalize Boolean.True
            Trigger.Value mr

          get self = self.mr.with .get

          clear self = self.mr.with (ref-> ref.put Nothing)
      """);
    trigger = module.invokeMember("eval_expression", "Trigger.new");
  }

  void simulateReloadTestOnly() {
    trigger.invokeMember("clear");
  }
}
