package org.enso.base.cache;

import org.enso.base.polyglot.EnsoMeta;
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
    trigger =
        EnsoMeta.callStaticModuleMethod(
            "Standard.Base.Network.Reload_Detector", "create_reload_detector");
  }

  void simulateReloadTestOnly() {
    trigger.invokeMember("clear");
  }
}
