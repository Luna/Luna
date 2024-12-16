package org.enso.runtimeversionmanager.runner

import org.enso.runtimeversionmanager.components.GraalRuntime

/** Represents a way of launching the JVM.
  *
  * @param executableName name of the `java` executable to run
  * @param javaHomeOverride if set, asks to override the JAVA_HOME environment
  *                         variable when launching the JVM
  */
class JavaCommand(
  val executableName: String,
  val javaHomeOverride: Option[String]
)

object JavaCommand {

  /** The [[JavaCommand]] representing the system-configured JVM.
    */
  def systemJavaCommand: JavaCommand = new JavaCommand("java", None)

  /** The [[JavaCommand]] representing a managed [[GraalRuntime]].
    */
  def forRuntime(runtime: GraalRuntime): JavaCommand =
    new JavaCommand(
      executableName = runtime.javaExecutable.toAbsolutePath.normalize.toString,
      javaHomeOverride = Some(
        runtime.javaHome.toAbsolutePath.normalize.toString
      )
    )

}
