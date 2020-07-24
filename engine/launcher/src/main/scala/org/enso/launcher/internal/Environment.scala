package org.enso.launcher.internal

import java.io.File
import java.nio.file.Path

import org.enso.launcher.Logger

import scala.util.Try

trait Environment {

  /**
    * Returns a list of system-dependent plugin extensions.
    *
    * By default, on Unix plugins should have no extensions. On Windows, `.exe`
    * `.bat` and `.cmd` are supported.
    */
  def getPluginExtensions: Seq[String] =
    if (OS.isWindows)
      Seq(".exe", ".bat", ".cmd")
    else Seq()

  /**
    * Returns a list of directories that can be ignored when traversing the
    * system PATH looking for plugins.
    *
    * These could be system directories that should not contain plguins anyway,
    * but traversing them would greatly slow down plugin discovery.
    */
  def getIgnoredPathDirectories: Seq[Path] =
    if (OS.isWindows) Seq(Path.of("C:\\Windows")) else Seq()

  /**
    * Queries the system environment for the given variable that should
    * represent a valid filesystem path. If it is not defined or is not a valid
    * path, returns None.
    */
  def getEnvPath(key: String): Option[Path] = {
    def parsePathWithWarning(str: String): Option[Path] = {
      val result = safeParsePath(str)
      if (result.isEmpty) {
        Logger.warn(
          s"System variable `$key` was set (to value `$str`), but it did not " +
          s"represent a valid path, so it has been ignored."
        )
      }

      result
    }

    getEnvVar(key).flatMap(parsePathWithWarning)
  }

  /**
    * Returns the system PATH, if available.
    */
  def getSystemPath: Seq[Path] =
    getEnvVar("PATH")
      .map(_.split(File.pathSeparatorChar).toSeq.flatMap(safeParsePath))
      .getOrElse(Seq())

  /**
    * Returns the location of the HOME directory on Unix systems.
    *
    * Should not be called on Windows, as the concept of HOME should be handled
    * differently there.
    */
  def getHome: Path = {
    if (OS.isWindows)
      throw new IllegalStateException(
        "fatal error: HOME should not be queried on Windows"
      )
    else {
      getEnvVar("HOME").flatMap(safeParsePath) match {
        case Some(path) => path
        case None =>
          throw new RuntimeException(
            "fatal error: HOME environment variable is not defined."
          )
      }
    }
  }

  /**
    * Returns the location of the local application data directory
    * (`%LocalAppData%`) on Windows. Should not be called on platforms other
    * than Windows, as this concept is defined in different ways there.
    */
  def getLocalAppData: Path = {
    if (!OS.isWindows)
      throw new IllegalStateException(
        "fatal error: LocalAppData should be queried only on Windows"
      )
    else {
      getEnvVar("LocalAppData").flatMap(safeParsePath) match {
        case Some(path) => path
        case None =>
          throw new RuntimeException(
            "fatal error: %LocalAppData% environment variable is not defined."
          )
      }
    }
  }

  /**
    * Queries the system environment for the given variable. If it is not defined
    * or empty, returns None.
    */
  def getEnvVar(key: String): Option[String] = {
    val value = System.getenv(key)
    if (value == null || value == "") None
    else Some(value)
  }

  /**
    * Tries to parse a path string and returns Some(path) on success.
    *
    * We prefer silent failures here (returning None and skipping that entry),
    * as we don't want to fail the whole command if the PATH contains some
    * unparseable entries.
    */
  private def safeParsePath(str: String): Option[Path] =
    Try(Path.of(str)).toOption

  def getPathToRunningBinaryExecutable: Path = {
    val codeSource =
      this.getClass.getProtectionDomain.getCodeSource
    Path.of(codeSource.getLocation.getPath).toAbsolutePath
  }
}
