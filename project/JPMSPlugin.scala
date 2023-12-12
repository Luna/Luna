import sbt.*
import sbt.Keys.*
import sbt.internal.inc.{CompileOutput, PlainVirtualFile}
import sbt.util.CacheStore
import sbtassembly.Assembly.{Dependency, JarEntry, Project}
import sbtassembly.{CustomMergeStrategy, MergeStrategy}
import xsbti.compile.IncToolOptionsUtil

import java.io.File

/** An automatic plugin that handles everything related to JPMS modules. One needs to explicitly
  * enable this plugin in a project with `.enablePlugins(JPMSPlugin)`. The keys and tasks provided by this plugin
  * corresponds to the module-related options of `javac` and `java` commands.
  *
  * This plugin injects all the module-specific options to `javaOptions` and `javacOptions`, based on
  * the settings of this plugin.
  *
  * If this plugin is enabled, and no settings/tasks from this plugin are used, then the plugin will
  * not inject anything into `javaOptions` or `javacOptions`.
  */
object JPMSPlugin extends AutoPlugin {
  object autoImport {
    val javaModuleName =
      settingKey[String]("The name of the Java (JPMS) module")
    val addModules = settingKey[Seq[String]](
      "Module names that will be added to --add-modules option"
    )
    val modulePath = taskKey[Seq[File]](
      "Directories (Jar archives or expanded Jar archives) that will be put into " +
      "--module-path option"
    )
    val patchModules = taskKey[Map[String, Seq[File]]](
      """
        |A map of module names to directories (Jar archives or expanded Jar archives) that will be
        |put into --patch-module option.
        |""".stripMargin
    )
    val addExports = taskKey[Map[String, Seq[String]]](
      """
        |A map of module names to packages that will be put into --add-exports option.
        |The format of `--add-exports` option is `module/package=target-module(,target-module)*`
        |The key in the map is `module/package` and the value is a sequence of target modules
        |""".stripMargin
    )
    val compileModuleInfo = taskKey[Unit]("Compile module-info.java")
    val modulePathTestOptions_ = taskKey[Seq[String]](
      "Assembles options for the JVM for running tests with all the required modules. " +
      "Including truffle-compiler and org.enso.runtime modules and all their dependencies."
    )
  }

  import autoImport.*

  override lazy val projectSettings: Seq[Setting[_]] = Seq(
    addModules := Seq.empty,
    modulePath := Seq.empty,
    patchModules := Map.empty,
    addExports := Map.empty,
    compileModuleInfo := {},
    javacOptions ++= {
      constructOptions(
        modulePath.value,
        addModules.value,
        patchModules.value,
        addExports.value,
        streams.value.log
      )
    },
    javaOptions ++= {
      constructOptions(
        modulePath.value,
        addModules.value,
        patchModules.value,
        addExports.value,
        streams.value.log
      )
    }
  )

  private def constructOptions(
    modulePath: Seq[File],
    addModules: Seq[String],
    patchModules: Map[String, Seq[File]],
    addExports: Map[String, Seq[String]],
    log: Logger
  ): Seq[String] = {
    val patchOpts: Seq[String] = patchModules.flatMap {
      case (moduleName, dirsToPatch) =>
        ensureDirectoriesExist(dirsToPatch, log)
        val patchStr = dirsToPatch
          .map(_.getAbsolutePath)
          .mkString(File.pathSeparator)
        Seq(
          "--patch-module",
          s"$moduleName=$patchStr"
        )
    }.toSeq

    ensureDirectoriesExist(modulePath, log)

    val addExportsOpts: Seq[String] = addExports.flatMap {
      case (modPkgName, targetModules) =>
        if (!modPkgName.contains("/")) {
          log.error(s"JPMSPlugin: Invalid module/package name: $modPkgName")
        }
        Seq(
          "--add-exports",
          modPkgName + "=" + targetModules.mkString(",")
        )
    }.toSeq

    val modulePathOpts = if (modulePath.isEmpty) {
      Seq.empty
    } else {
      Seq(
        "--module-path",
        modulePath.map(_.getAbsolutePath).mkString(File.pathSeparator)
      )
    }

    val addModsOpts = if (addModules.isEmpty) {
      Seq.empty
    } else {
      Seq(
        "--add-modules",
        addModules.mkString(",")
      )
    }

    modulePathOpts ++ addModsOpts ++ patchOpts ++ addExportsOpts
  }

  /** Java does not mandate that the directories specified in the module path or
    * in --patch-module exist, but it is usefull to report at least warnings.
    * @param dirs
    * @param log
    */
  private def ensureDirectoriesExist(
    dirs: Seq[File],
    log: Logger
  ): Unit = {
    dirs.foreach { dir =>
      if (!dir.exists()) {
        log.warn(s"JPMSPlugin: Directory $dir does not exist.")
      }
    }
  }
}
