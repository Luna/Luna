package org.enso.logger;

import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.joran.JoranConfigurator;
import ch.qos.logback.core.joran.spi.JoranException;
import ch.qos.logback.core.util.StatusPrinter;
import java.io.InputStream;
import org.enso.logger.config.Loggers;
import org.enso.logger.config.LoggingService;
import org.slf4j.LoggerFactory;
import org.slf4j.event.Level;

public class LoggerContextSetup {

  public static Boolean setup(Level level, String componentName, InputStream customLogConfig) {
    return setup(level, componentName, customLogConfig, LoggingService.parseConfig());
  }

  public static Boolean setup(
      Level logLevel, String componentName, InputStream customLogConfig, LoggingService appConfig) {
    var serverConfig = appConfig.getServer();
    var appenderName = appConfig.getAppender();
    return setup(
        logLevel,
        componentName,
        customLogConfig,
        appenderName,
        serverConfig.hostname(),
        serverConfig.port(),
        appConfig.getLoggers());
  }

  public static Boolean setup(
      Level logLevel,
      String componentName,
      InputStream customLogConfig,
      String appenderName,
      String hostname,
      int port) {
    return setup(logLevel, componentName, customLogConfig, appenderName, hostname, port, null);
  }

  public static Boolean setup(
      Level logLevel,
      String componentName,
      InputStream customLogConfig,
      String appenderName,
      String hostname,
      int port,
      Loggers loggers) {
    var context = (LoggerContext) LoggerFactory.getILoggerFactory();
    var logbackLevel = ch.qos.logback.classic.Level.convertAnSLF4JLevel(logLevel);
    System.setProperty(componentName + ".logLevel", logbackLevel.toString().toLowerCase());
    System.setProperty(componentName + ".appender", appenderName);
    if (hostname != null) {
      System.setProperty("logging-server.host", hostname);
    }
    if (port != 0) {
      System.setProperty("logging-server.port", String.valueOf(port));
    }
    try {
      var configurator = new JoranConfigurator();
      configurator.setContext(context);
      // Call context.reset() to clear any previous configuration, e.g. default
      // configuration.
      context.reset();
      configurator.doConfigure(customLogConfig);
      var rootLogger = context.getLogger("root");
      var appender = rootLogger.getAppender(appenderName);
      if (appender == null) {
        System.err.println(
            "Failed to apply custom log levels for application loggers' in " + appenderName);
      } else {
        if (loggers != null) {
          var filter = ApplicationFilter.fromLoggers(loggers);
          appender.addFilter(filter);
        }
      }
      return true;
    } catch (JoranException je) {
      je.printStackTrace();
      StatusPrinter.printInCaseOfErrorsOrWarnings(context);
      System.err.println("Failed to setup Logback configuration");
      return false;
    }
  }

  public static void teardown() {
    var context = (LoggerContext) LoggerFactory.getILoggerFactory();
    context.stop();
  }
}
