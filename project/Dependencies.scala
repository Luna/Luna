import sbt._

object Dependencies {

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

  object Compile {
    val snakeyaml = "org.yaml" % "snakeyaml" % Versions.snakeyaml
    val circeCore = "io.circe" %% "circe-core" % Versions.circeCore
    val apacheCommonsCompress = "org.apache.commons" % "commons-compress" % Versions.commonsCompress
  }

  object Test {
    val scalatest: ModuleID = "org.scalatest" %% "scalatest" % Versions.scalatest % "test"
    val scalacheck: ModuleID = "org.scalacheck" %% "scalacheck" % Versions.scalacheck % "test"
  }

  import Compile._
}
