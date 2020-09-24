package org.enso.launcher.cli

import com.typesafe.scalalogging.Logger
import org.enso.cli.CLIOutput
import org.enso.launcher.locking.DefaultResourceManager
import org.enso.launcher.upgrade.LauncherUpgrader
import org.enso.loggingservice.internal.server.WSExample
import org.enso.loggingservice.{LogLevel, WSLoggerManager, WSLoggerMode}

/**
  * Defines the entry point for the launcher.
  */
object Main {
  private def setup(): Unit =
    System.setProperty(
      "org.apache.commons.logging.Log",
      "org.apache.commons.logging.impl.NoOpLog"
    )

  private def runAppHandlingParseErrors(args: Array[String]): Int =
    LauncherApplication.application.run(args) match {
      case Left(errors) =>
        CLIOutput.println(errors.mkString("\n"))
        1
      case Right(exitCode) =>
        exitCode
    }

  private val logger = Logger[Main.type]

  def main(args: Array[String]): Unit = {
    setup()
    logger.debug("DEBUG BEFORE SETUP")
    logger.info("BEFORE SETUP")
    WSLoggerManager.setup(WSLoggerMode.Local(), LogLevel.Debug)
    logger.info("after SETUP")
    WSExample.test()
    val exitCode =
      try {
        LauncherUpgrader.recoverUpgradeRequiredErrors(args) {
          runAppHandlingParseErrors(args)
        }
      } catch {
        case e: Exception =>
          logger.error(s"A fatal error has occurred: $e", e)
          1
      }

    WSLoggerManager.tearDown()
    DefaultResourceManager.releaseMainLock()
    sys.exit(exitCode)
  }
}
