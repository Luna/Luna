package org.enso.loggingservice

import org.enso.loggingservice.internal.serviceconnection.{
  Client,
  Local,
  Server,
  Service
}
import org.enso.loggingservice.internal.{
  BlockingConsumerMessageQueue,
  InternalLogMessage,
  LoggerConnection
}
import org.enso.loggingservice.printers.StderrPrinter

import scala.concurrent.Future

object WSLoggerManager {
  private val messageQueue           = new BlockingConsumerMessageQueue()
  private var currentLevel: LogLevel = LogLevel.Trace
  object Connection extends LoggerConnection {
    override def send(message: InternalLogMessage): Unit =
      messageQueue.send(Left(message))
    override def logLevel: LogLevel = currentLevel
  }

  private var currentService: Option[Service] = None

  /**
    * Sets up the logging service, but in a separate thread to avoid stalling
    * the application.
    */
  def setup[InitializationResult](
    mode: WSLoggerMode[InitializationResult],
    logLevel: LogLevel
  ): Future[InitializationResult] = {
    currentLevel = logLevel
    import scala.concurrent.ExecutionContext.Implicits.global
    Future(doSetup(mode, logLevel))
  }

  /**
    * Tries to set up the logging service, falling back to a simple logger if it
    * failed.
    *
    * The returned future will contain `true` if the original backend was set-up
    * or `false` if it had to fall back to stderr.
    */
  def setupWithFallbackToLocal(
    mode: WSLoggerMode[_],
    fallbackMode: WSLoggerMode[_],
    logLevel: LogLevel
  ): Future[Boolean] = {
    import scala.concurrent.ExecutionContext.Implicits.global
    setup(mode, logLevel).map(_ => true).recoverWith { error =>
      InternalLogger.error(s"Failed to initialize the logging server: $error")
      InternalLogger.error("Falling back to a simple stderr backend.")
      setup(fallbackMode, logLevel).map(_ => false)
    }
  }

  def tearDown(): Unit = {
    val service = currentService.synchronized {
      val service = currentService
      currentService = None
      service
    }

    service match {
      case Some(running) => running.terminate()
      case None          => handleMissingLogger()
    }
  }

  def replaceWithFallback(): Unit = {
    val fallback =
      Local.setup(currentLevel, messageQueue, Seq(StderrPrinter))
    val service = currentService.synchronized {
      val service = currentService
      currentService = Some(fallback)
      service
    }

    service.foreach(_.terminate())
  }

  Runtime.getRuntime.addShutdownHook(new Thread(() => tearDown()))

  private def handleMissingLogger(): Unit = {
    val danglingMessages = messageQueue.drain()
    if (danglingMessages.nonEmpty) {
      InternalLogger.error(
        "It seems that the logging service was never set up, " +
        "or log messages were reported after it has been terminated. " +
        "These messages are printed below:"
      )
      danglingMessages.foreach { message =>
        if (currentLevel.shouldLog(message.logLevel)) {
          StderrPrinter.print(message)
        }
      }
    }
  }

  private def doSetup[InitializationResult](
    mode: WSLoggerMode[InitializationResult],
    logLevel: LogLevel
  ): InitializationResult = {
    currentService.synchronized {
      if (currentService.isDefined) {
        throw new IllegalStateException(
          "The logging service has already been set up."
        )
      }

      val (service, result: InitializationResult) = mode match {
        case WSLoggerMode.Client(endpoint) =>
          (Client.setup(endpoint, messageQueue, logLevel), ())
        case WSLoggerMode.Server(printers, port, interface) =>
          val server = Server.setup(
            interface,
            port.getOrElse(0),
            messageQueue,
            printers,
            logLevel
          )
          (server, server.getBinding())
        case WSLoggerMode.Local(printers) =>
          (Local.setup(logLevel, messageQueue, printers), ())
      }
      currentService = Some(service)
      result
    }
  }
}
