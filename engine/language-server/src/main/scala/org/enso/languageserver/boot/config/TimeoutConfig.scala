package org.enso.languageserver.boot.config

import scala.concurrent.duration.FiniteDuration

/** A configuration object for timeout properties.
  *
  * @param delayedShutdownTimeout a timeout when shutdown, caused by lack of clients, can be cancelled
  */
case class TimeoutConfig(delayedShutdownTimeout: FiniteDuration)
