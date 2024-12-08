import sbt._

object Dependencies {

  val dependencyUpgradeModuleNames = Map(
    "circe-core" -> "circe",
    "slf4j-simple" -> "slf4j"
  )

  object Todo {
    val slf4j = "1.3.7"
    val logbackClassic = "2.0.9"
  }

  object Versions {
    val circeCore = "0.14.10"
    val commonsCompress = "1.27.1"
    val scalacheck = "1.18.1"
    val scalatest = "3.2.19"
    val snakeyaml = "2.3"
  }

  /** Compile dependencies of the project.
    *
    * The dependencies can be automatically updated with the `dependencyUpgrade` command provided by
    * `sbt-dependency-update` plugin.
    *
    * To work correctly, the dependency definition should have the following structure:
    *
    * {{{
    *   val arbitraryName = "group.id" % "artifact-id" % Versions.artifactId
    * }}}
    *
    * i.e the `Versions.artifactId` identifier should be the camel case translation of the corresponding `artifact-id`.
    * The mapping can be overridden by the `dependencyUpgradeModuleNames` setting.
    */
  object Compile {
    val snakeyaml = "org.yaml" % "snakeyaml" % Versions.snakeyaml
    val circeCore = "io.circe" %% "circe-core" % Versions.circeCore
    val apacheCommonsCompress = "org.apache.commons" % "commons-compress" % Versions.commonsCompress
  }

  object Test {
    val scalatest = "org.scalatest" %% "scalatest" % Versions.scalatest % "test"
    val scalacheck = "org.scalacheck" %% "scalacheck" % Versions.scalacheck % "test"
  }

  import Compile._
}
