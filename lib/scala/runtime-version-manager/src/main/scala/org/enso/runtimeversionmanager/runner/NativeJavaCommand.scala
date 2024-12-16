package org.enso.runtimeversionmanager.runner

import org.enso.cli.OS
import org.enso.distribution.{DistributionManager, Environment}

import java.nio.file.Path

case class NativeJavaCommand(executablePath: Path)
    extends JavaCommand(executablePath.toString, None)

object NativeJavaCommand {
  def apply(version: String): NativeJavaCommand = {
    val env      = new Environment() {}
    val dm       = new DistributionManager(env)
    val execName = OS.executableName("enso")
    val fullExecPath =
      dm.paths.engines.resolve(version).resolve("bin").resolve(execName)
    new NativeJavaCommand(fullExecPath)
  }
}
