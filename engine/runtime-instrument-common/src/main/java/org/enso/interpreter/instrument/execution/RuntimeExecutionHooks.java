package org.enso.interpreter.instrument.execution;

import java.util.LinkedHashSet;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class RuntimeExecutionHooks implements ExecutionHooks {

  private final Logger logger = LoggerFactory.getLogger(getClass());
  private final Set<Runnable> hooks = new LinkedHashSet<>();

  public RuntimeExecutionHooks() {}

  @Override
  public void add(Runnable hook) {
    synchronized (hooks) {
      hooks.add(hook);
    }
  }

  @Override
  public void run() {
    synchronized (hooks) {
      for (Runnable hook : hooks) {
        try {
          hook.run();
        } catch (Exception e) {
          logger.error("Failed to run execution hook.", e);
        }
      }
      hooks.clear();
    }
  }
}
