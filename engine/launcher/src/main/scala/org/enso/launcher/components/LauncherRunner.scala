package org.enso.launcher.components

import org.enso.semver.SemVer
import org.enso.distribution.{DistributionManager, Environment}
import org.enso.editions.updater.EditionManager
import org.enso.launcher.Constants
import org.enso.launcher.project.ProjectManager
import org.enso.logger.masking.MaskedPath

import java.net.URI
import org.enso.runtimeversionmanager.components.RuntimeVersionManager
import org.enso.runtimeversionmanager.config.GlobalRunnerConfigurationManager
import org.enso.runtimeversionmanager.runner._
import org.slf4j.event.Level

import java.nio.file.{Files, Path}
import scala.concurrent.Future
import scala.util.Try

/** Extends the [[Runner]] with launcher specific logic for project discovery.
  */
class LauncherRunner(
  projectManager: ProjectManager,
  distributionManager: DistributionManager,
  configurationManager: GlobalRunnerConfigurationManager,
  componentsManager: RuntimeVersionManager,
  editionManager: EditionManager,
  environment: Environment,
  loggerConnection: Future[Option[URI]]
) extends Runner(
      componentsManager,
      distributionManager,
      configurationManager,
      editionManager,
      environment,
      loggerConnection
    ) {

  /** Creates [[RunSettings]] for launching the REPL.
    *
    * See [[org.enso.launcher.Launcher.runRepl]] for more details.
    */
  def repl(
    projectPath: Option[Path],
    versionOverride: Option[SemVer],
    logLevel: Level,
    logMasking: Boolean,
    additionalArguments: Seq[String]
  ): Try[RunSettings] =
    Try {
      val inProject = projectPath match {
        case Some(value) =>
          Some(projectManager.loadProject(value).get)
        case None =>
          projectManager.findProject(currentWorkingDirectory).get
      }

      val version          = resolveVersion(versionOverride, inProject)
      val workingDirectory = workingDirectoryForRunner(inProject, None)
      val arguments = inProject match {
        case Some(project) =>
          val projectPackagePath =
            project.path.toAbsolutePath.normalize.toString
          Seq("--repl", "--in-project", projectPackagePath)
        case None =>
          Seq("--repl")
      }
      RunSettings(
        version,
        arguments ++ setLogLevelArgs(logLevel, logMasking)
        ++ additionalArguments,
        workingDirectory         = workingDirectory,
        connectLoggerIfAvailable = true
      )
    }

  /** Creates [[RunSettings]] for running Enso projects or scripts.
    *
    * See [[org.enso.launcher.Launcher.runRun]] for more details.
    */
  def run(
    path: Option[Path],
    versionOverride: Option[SemVer],
    logLevel: Level,
    logMasking: Boolean,
    additionalArguments: Seq[String]
  ): Try[RunSettings] =
    Try {
      val actualPath = path
        .getOrElse {
          projectManager
            .findProject(currentWorkingDirectory)
            .get
            .getOrElse {
              throw RunnerError(
                "The current directory is not inside any project. `enso run` " +
                "should either get a path to a project or script to run, or " +
                "be run inside of a project to run that project."
              )
            }
            .path
        }
        .toAbsolutePath
        .normalize()
      if (!Files.exists(actualPath)) {
        throw RunnerError(s"$actualPath does not exist")
      }
      val projectMode = Files.isDirectory(actualPath)
      val project =
        if (projectMode) Some(projectManager.loadProject(actualPath).get)
        else projectManager.findProject(actualPath).get
      val version = resolveVersion(versionOverride, project)

      // The engine is started in the directory containing the project, or the standalone script.
      val workingDirectory =
        workingDirectoryForRunner(project, Some(actualPath))

      val arguments =
        if (projectMode) Seq("--run", actualPath.toString)
        else
          project match {
            case Some(project) =>
              Seq(
                "--run",
                actualPath.toString,
                "--in-project",
                project.path.toAbsolutePath.normalize().toString
              )
            case None =>
              Seq("--run", actualPath.toString)
          }
      RunSettings(
        version,
        arguments ++ setLogLevelArgs(logLevel, logMasking)
        ++ additionalArguments,
        workingDirectory         = workingDirectory,
        connectLoggerIfAvailable = true
      )
    }

  private def workingDirectoryForRunner(
    inProject: Option[Project],
    scriptPath: Option[Path]
  ): Option[Path] = {
    // The path of the project or standalone script that is being run.
    val baseDirectory = inProject match {
      case Some(project) => Some(project.path)
      case None          => scriptPath
    }

    baseDirectory.map(p => p.toAbsolutePath.normalize().getParent)
  }

  private def setLogLevelArgs(
    level: Level,
    logMasking: Boolean
  ): Seq[String] =
    Seq("--log-level", level.name) ++
    Option.unless(logMasking)("--no-log-masking")

  /** Creates [[RunSettings]] for launching the Language Server.
    *
    * See [[org.enso.launcher.Launcher.runLanguageServer]] for more details.
    */
  def languageServer(
    options: LanguageServerOptions,
    contentRootPath: Path,
    versionOverride: Option[SemVer],
    logLevel: Level,
    logMasking: Boolean,
    additionalArguments: Seq[String]
  ): Try[RunSettings] =
    for {
      project <- projectManager.loadProject(contentRootPath)
      runSettings <- startLanguageServer(
        options,
        project,
        versionOverride,
        logLevel,
        logMasking,
        additionalArguments
      )
    } yield runSettings

  /** Creates [[RunSettings]] for querying the currently selected engine
    * version.
    *
    * If the current working directory is inside of a project, the engine
    * associated with the project is queried, otherwise the default engine is
    * queried.
    *
    * @param useJSON if set to true, the returned [[RunSettings]] will request
    *                the version in JSON format, otherwise human readable text
    *                format will be used
    * @return the [[RunSettings]] and a [[WhichEngine]] indicating if the used
    *         engine was from a project (true) or the default one (false)
    */
  def version(useJSON: Boolean): Try[(RunSettings, WhichEngine)] = {
    for {
      project <- projectManager.findProject(currentWorkingDirectory)
    } yield {
      val version = resolveVersion(None, project)
      val arguments =
        Seq("--version") ++ (if (useJSON) Seq("--json") else Seq())

      val whichEngine =
        project match {
          case Some(value) => WhichEngine.FromProject(value.name)
          case None        => WhichEngine.Default
        }

      (
        RunSettings(
          version,
          arguments,
          workingDirectory         = None,
          connectLoggerIfAvailable = false
        ),
        whichEngine
      )
    }
  }

  /** Creates [[RunSettings]] for uploading a library.
    *
    * See [[org.enso.launcher.Launcher.uploadLibrary]] for more details.
    */
  def uploadLibrary(
    path: Option[Path],
    uploadUrl: String,
    token: Option[String],
    hideProgress: Boolean,
    logLevel: Level,
    logMasking: Boolean,
    additionalArguments: Seq[String]
  ): Try[RunSettings] =
    Try {
      val actualPath = path.getOrElse(currentWorkingDirectory)
      val project = projectManager.findProject(actualPath).get.getOrElse {
        throw RunnerError(
          s"Could not find a project at " +
          s"${MaskedPath(actualPath).applyMasking()} or any of its parent " +
          s"directories."
        )
      }

      val version = resolveVersion(None, Some(project))
      if (version.isLessThan(Constants.uploadIntroducedVersion)) {
        throw RunnerError(
          s"Library Upload feature is not available in Enso $version. " +
          s"Please upgrade your project to a newer version."
        )
      }

      val tokenOpts = token.map(Seq("--auth-token", _)).toSeq.flatten
      val hideProgressOpts =
        if (hideProgress) Seq("--hide-progress") else Seq.empty

      val arguments =
        Seq("--upload", uploadUrl) ++
        Seq("--in-project", project.path.toAbsolutePath.normalize.toString) ++
        tokenOpts ++ hideProgressOpts
      RunSettings(
        version,
        arguments ++ setLogLevelArgs(logLevel, logMasking)
        ++ additionalArguments,
        workingDirectory         = None,
        connectLoggerIfAvailable = true
      )
    }

  /** Creates [[RunSettings]] for installing project dependencies.
    *
    * See [[org.enso.launcher.Launcher.runInstallDependencies]] for more
    * details.
    */
  def installDependencies(
    versionOverride: Option[SemVer],
    hideProgress: Boolean,
    logLevel: Level,
    logMasking: Boolean,
    additionalArguments: Seq[String]
  ): Try[RunSettings] =
    Try {
      val actualPath = currentWorkingDirectory
      val project = projectManager.findProject(actualPath).get.getOrElse {
        throw RunnerError(
          s"Could not find a project at " +
          s"${MaskedPath(actualPath).applyMasking()} or any of its parent " +
          s"directories."
        )
      }

      val version = resolveVersion(versionOverride, Some(project))
      if (
        version.isLessThan(Constants.preinstallDependenciesIntroducedVersion)
      ) {
        throw RunnerError(
          s"Project dependency installation feature is not available in Enso " +
          s"$version. Please upgrade your project to a newer version to use it."
        )
      }

      val hideProgressOpts =
        if (hideProgress) Seq("--hide-progress") else Seq.empty

      val arguments =
        Seq("--preinstall-dependencies") ++
        Seq("--in-project", project.path.toAbsolutePath.normalize.toString) ++
        hideProgressOpts
      RunSettings(
        version,
        arguments ++ setLogLevelArgs(logLevel, logMasking)
        ++ additionalArguments,
        workingDirectory         = None,
        connectLoggerIfAvailable = true
      )
    }
}
