package org.enso.launcher.cli

import org.enso.launcher.cli.impl.Parser

sealed trait PluginBehaviour
case object PluginNotFound                        extends PluginBehaviour
case class PluginInterceptedFlow(run: () => Unit) extends PluginBehaviour
trait PluginManager {
  def tryRunningPlugin(name: String, args: Seq[String]): PluginBehaviour
  def pluginsNames():                                    Seq[String]
  def pluginsHelp():                                     Seq[CommandHelp]
}

class Application(
  val name: String,
  val helpHeader: String,
  val commands: Seq[Command],
  val pluginManager: Option[PluginManager]
) {
  def parse(
    args: Seq[String]
  ): Either[List[String], () => Unit] = Parser.parseApplication(this)(args)

  def gatherCommandNames(): Seq[String] =
    commands.map(_.name) ++ pluginManager.map(_.pluginsNames()).getOrElse(Seq())

  def displayHelp(): Unit = {
    val subCommands = commands.map(_.topLevelHelp) ++ pluginManager
        .map(_.pluginsHelp())
        .getOrElse(Seq())

    val commandDescriptions =
      impl.alignTabulators(subCommands.map(_.toString)).mkString("\n")
    println(helpHeader)
    println("\nAvailable commands:")
    println(commandDescriptions)
  }
}

object Application {
  def apply(
    name: String,
    helpHeader: String,
    commands: Seq[Command],
    pluginManager: PluginManager
  ): Application =
    new Application(name, helpHeader, commands, Some(pluginManager))
}
