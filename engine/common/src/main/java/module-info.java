module org.enso.engine.common {
  requires org.graalvm.polyglot;
  requires org.graalvm.truffle;
  requires org.enso.logging.utils;
  requires org.enso.logging.config;
  requires org.slf4j;

  exports org.enso.common;
}
