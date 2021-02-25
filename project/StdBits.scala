import sbt.Keys._
import sbt._
import sbt.io.IO
import sbt.librarymanagement.{ConfigurationFilter, DependencyFilter}

object StdBits {

  /** Discovers dependencies of a project and copies them into the destination
    * directory.
    *
    * @param destination location where to put the dependencies
    * @param baseJarName name of the base generated JAR (if any); unexpected
    *                    (old) files are removed, so this task needs to know
    *                    this file's name to avoid removing it
    * @param ignoreScalaLibrary whether to ignore Scala dependencies that are
    *                           added by default be SBT and are not relevant in
    *                           pure-Java projects
    */
  def copyDependencies(
    destination: File,
    baseJarName: Option[String],
    ignoreScalaLibrary: Boolean
  ): Def.Initialize[Task[Unit]] =
    Def.task {
      val libraryUpdates = (Compile / update).value
      val log            = streams.value.log

      val ignoredConfigurations: NameFilter =
        if (ignoreScalaLibrary)
          new ExactFilter(Configurations.ScalaTool.name)
        else NothingFilter
      val filter: ConfigurationFilter =
        DependencyFilter.configurationFilter(-ignoredConfigurations)
      val relevantFiles = libraryUpdates.select(filter)

      val dependencyStore =
        streams.value.cacheStoreFactory.make("std-bits-dependencies")
      Tracked.diffInputs(dependencyStore, FileInfo.hash)(relevantFiles.toSet) {
        report =>
          val expectedFileNames =
            report.checked.map(_.getName) ++ baseJarName.toSeq
          for (existing <- IO.listFiles(destination)) {
            if (!expectedFileNames.contains(existing.getName)) {
              log.info(
                s"Removing outdated std-bits dependency ${existing.getName}."
              )
              IO.delete(existing)
            }
          }
          for (changed <- report.modified -- report.removed) {
            log.info(
              s"Updating changed std-bits dependency ${changed.getName}."
            )
            IO.copyFile(changed, destination / changed.getName)
          }
          for (file <- report.unmodified) {
            val dest = destination / file.getName
            if (!dest.exists()) {
              log.info(s"Adding missing std-bits dependency ${file.getName}.")
              IO.copyFile(file, dest)
            }
          }
      }
    }
}
