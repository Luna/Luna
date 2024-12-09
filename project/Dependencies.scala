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

  /** Manually updated versions. */
  object VersionsPinned {
    val akkaActor = "2.6.20"
    val graalMavenPackages = "24.0.0"
  }

  /** Versions updated automatically by running the `dependencyUpgrade` command. */
  object Versions {
    val akkaActor = "2.8.8"
    val circeCore = "0.14.10"
    val commonsCompress = "1.27.1"
    val scalacheck = "1.18.1"
    val scalatest = "3.2.19"
    val snakeyaml = "2.3"
    val svm = "24.1.1"
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
    val akkaActor = "com.typesafe.akka" %% "akka-actor" % VersionsPinned.akkaActor
    val nativeimageSvm = "org.graalvm.nativeimage" % "svm" % VersionsPinned.graalMavenPackages
  }

  object Test {
    val scalatest = "org.scalatest" %% "scalatest" % Versions.scalatest % "test"
    val scalacheck = "org.scalacheck" %% "scalacheck" % Versions.scalacheck % "test"
  }

  import Compile._
}
