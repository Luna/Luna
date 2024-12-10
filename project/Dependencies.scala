import sbt._

object Dependencies {

  /** Versions updated automatically by running the `dependencyUpgrade` command.
    *
    * Manual interventions after update:
    *   - slf4jApi : update module `org.enso.truffleloggerwrapper.TruffleLoggerWrapperProvider`
    */
  object Versions {
    val scalacheck = "1.17.0"
    val scalatest = "3.2.19"
  }
}
