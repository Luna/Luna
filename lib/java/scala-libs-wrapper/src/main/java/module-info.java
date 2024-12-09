module org.enso.scala.wrapper {
  requires scala.library;
  requires scala.reflect;
  requires org.jline;
  requires org.slf4j;

  exports org.enso.scala.wrapper;

  // "org.typelevel" % ("cats-core_" + scalaVer) % "2.10.0",
  exports cats;
  exports cats.arrow;
  exports cats.compat;
  exports cats.conversions;
  exports cats.data;
  exports cats.evidence;
  exports cats.instances;
  exports cats.instances.symbol;
  exports cats.syntax;

  // "com.github.plokhotnyuk.jsoniter-scala" % ("jsoniter-scala-macros_" + scalaVer) %
  // jsoniterVersion,
  exports com.github.plokhotnyuk.jsoniter_scala.macros;

  // "com.typesafe.scala-logging" % ("scala-logging_" + scalaVer) % scalaLoggingVersion,
  exports com.typesafe.scalalogging;

  // "io.circe" % ("circe-core_" + scalaVer) % circeVersion,
  exports io.circe;
  exports io.circe.cursor;
  exports io.circe.export;
  exports io.circe.numbers;
  exports io.circe.syntax;

  // "io.circe" % ("circe-parser_" + scalaVer) % circeVersion,
  exports io.circe.parser;

  // "io.circe" % ("circe-generic_" + scalaVer) % circeVersion,
  exports io.circe.generic.decoding;
  exports io.circe.generic;
  exports io.circe.generic.util;
  exports io.circe.generic.util.macros;
  exports io.circe.generic.codec;
  exports io.circe.generic.auto;
  exports io.circe.generic.encoding;

  // "io.circe" % ("circe-jawn_" + scalaVer) % circeVersion,
  exports io.circe.jawn;
}
