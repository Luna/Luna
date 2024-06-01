package org.enso.ydoc;

import java.util.concurrent.Semaphore;

public class Main {

  private static final Semaphore lock = new Semaphore(0);

  private Main() {}

  public static void main(String[] args) throws Exception {
    System.setProperty(
        "helidon.serialFilter.pattern",
        "javax.management.**;java.lang.**;java.rmi.**;javax.security.auth.Subject;!*");

    Sampling.init();

    try (var ydoc = Ydoc.builder().build()) {
      ydoc.start();
      lock.acquire();
    }
  }
}
