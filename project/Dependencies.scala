import sbt._

object Dependencies {

  val dependencyUpgradeModuleNames = Map(
    "circe-core" -> "circe",
    "slf4j-simple" -> "slf4j"
  )

  object Todo {
    val slf4j = "2.0.9"
    val logbackClassic = "1.3.7"
  }

  /** Manually updated versions. */
  object VersionsPinned {
    val akkaActor = "2.6.20"
    val graalMavenPackages = "24.0.0"
    val scala = "2.13.15"
  }

  /** Versions updated automatically by running the `dependencyUpgrade` command.
    *
    * Manual interventions after update:
    *   - slf4jApi : update module `org.enso.truffleloggerwrapper.TruffleLoggerWrapperProvider`
    */
  object Versions {
    val akkaActor = "2.8.8"
    val catsCore = "2.12.0"
    val catsKernel = "2.10.0"
    val circeCore = "0.14.10"
    val circeGeneric = "0.14.10"
    val circeJawn = "0.14.10"
    val circeNumbers = "0.14.10"
    val circeParser = "0.14.10"
    val commonsCompress = "1.27.1"
    val commonsIo = "2.18.0"
    val commonsLang3 = "3.17.0"
    val config = "1.4.3"
    val javaDiffUtils = "4.12"
    val jline = "3.27.1"
    val jna = "5.15.0"
    val jsoniterScalaCore = "2.28.5"
    val jsoniterScalaMacros = "2.31.3"
    val junit = "4.13.2"
    val junitInterface = "0.13.3"
    val logbackClassic = "1.5.12"
    val logbackCore = "1.5.12"
    val orgNetbeansModulesSampler = "RELEASE230"
    val orgOpenideUtilLookup = "RELEASE230"
    val scalaCompiler = "2.13.15"
    val scalaLogging = "3.9.5"
    val scalacheck = "1.18.1"
    val scalatest = "3.2.19"
    val sentry = "7.18.1"
    val sentryLogback = "7.18.1"
    val shapeless = "2.3.10"
    val slf4jApi = "2.0.16"
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
    *   val arbitraryName = "ppppgroup.id" % "artifact-id" % Versions.artifactId
    * }}}
    *
    * i.e the `Versions.artifactId` identifier should be the camel case translation of the corresponding `artifact-id`.
    * The mapping can be overridden by the `dependencyUpgradeModuleNames` setting.
    */
  object Compile {
    val akkaActor = "com.typesafe.akka" %% "akka-actor" % VersionsPinned.akkaActor
    val catsCore = "org.typelevel" %% "cats-core" % Versions.catsCore
    val catsKernel = "org.typelevel" %% "cats-kernel" % Versions.catsKernel
    val circeGeneric = "io.circe" %% "circe-generic" % Versions.circeGeneric
    val circeCore = "io.circe" %% "circe-core" % Versions.circeCore
    val circeParser = "io.circe" %% "circe-parser" % Versions.circeParser
    val circeJawn = "io.circe" %% "circe-jawn" % Versions.circeJawn
    val circeNumbers = "io.circe" %% "circe-numbers" % Versions.circeNumbers
    val commonsCompress = "org.apache.commons" % "commons-compress" % Versions.commonsCompress
    val commonsIo = "commons-io" % "commons-io" % Versions.commonsIo
    val commonsLang3 = "org.apache.commons" % "commons-lang3" % Versions.commonsLang3
    val javaDiffUtils = "io.github.java-diff-utils" % "java-diff-utils" % Versions.javaDiffUtils
    val jline = "org.jline" % "jline" % Versions.jline
    val jna = "net.java.dev.jna" % "jna" % Versions.jna
    val jsoniterScalaMacros =
      "com.github.plokhotnyuk.jsoniter-scala" %% "jsoniter-scala-macros" % Versions.jsoniterScalaMacros
    val jsoniterScalaCore =
      "com.github.plokhotnyuk.jsoniter-scala" %% "jsoniter-scala-core" % Versions.jsoniterScalaCore
    val junit = "junit" % "junit" % Versions.junit
    val logbackClassic = "ch.qos.logback" % "logback-classic" % Versions.logbackClassic
    val logbackCore = "ch.qos.logback" % "logback-core" % Versions.logbackCore
    val nativeimageSvm = "org.graalvm.nativeimage" % "svm" % VersionsPinned.graalMavenPackages
    val netbeansModulesSampler =
      "org.netbeans.api" % "org-netbeans-modules-sampler" % Versions.orgNetbeansModulesSampler
    val openideUtilLookup = "org.netbeans.api" % "org-openide-util-lookup" % Versions.orgOpenideUtilLookup
    val sbtJunitInterface = "com.github.sbt" % "junit-interface" % Versions.junitInterface
    val scalaCompiler = "org.scala-lang" % "scala-compiler" % VersionsPinned.scala
    val scalaLibrary = "org.scala-lang" % "scala-library" % VersionsPinned.scala
    val scalaReflect = "org.scala-lang" % "scala-reflect" % VersionsPinned.scala
    val scalaLogging = "com.typesafe.scala-logging" %% "scala-logging" % Versions.scalaLogging
    val scalatest = "org.scalatest" %% "scalatest" % Versions.scalatest
    val sentryLogback = "io.sentry" % "sentry-logback" % Versions.sentryLogback
    val sentry = "io.sentry" % "sentry" % Versions.sentry
    val shapeless = "com.chuusai" %% "shapeless" % Versions.shapeless
    val slf4jApi = "org.slf4j" % "slf4j-api" % Versions.slf4jApi
    val snakeyaml = "org.yaml" % "snakeyaml" % Versions.snakeyaml
    val typesafeConfig = "com.typesafe" % "config" % Versions.config
  }

  object Test {
    val scalatest = "org.scalatest" %% "scalatest" % Versions.scalatest % "test"
    val scalacheck = "org.scalacheck" %% "scalacheck" % Versions.scalacheck % "test"
    val junit = "junit" % "junit" % Versions.junit % "test"
    val sbtJunitInterface = "com.github.sbt" % "junit-interface" % Versions.junitInterface % "test"
  }

  import Compile._
}
