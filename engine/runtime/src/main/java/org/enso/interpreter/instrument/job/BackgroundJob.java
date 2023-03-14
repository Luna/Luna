package org.enso.interpreter.instrument.job;

import scala.collection.immutable.List$;

/** The job that runs in the background. */
public abstract class BackgroundJob<A> extends Job<A> implements Comparable<BackgroundJob<?>> {

  private final int priority;

  public BackgroundJob(int priority) {
    super(List$.MODULE$.empty(), false, false);
    this.priority = priority;
  }

  public int getPriority() {
    return priority;
  }

  @Override
  public int compareTo(BackgroundJob<?> that) {
    return Integer.compare(this.priority, that.getPriority());
  }
}
