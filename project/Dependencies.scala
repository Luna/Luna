import sbt._

object Dependencies {

  object Versions {
    val bouncyCastle = "1.76"
    val logbackClassic = "1.3.7"
    val scalacheck = "1.18.1"
    val scalatest = "3.2.19"
    val slf4j = "2.0.9"
    val snakeyaml = "2.3"
  }

  object Compile {
    val bouncyCastle = Seq(
      "org.bouncycastle" % "bcutil-jdk18on" % Versions.bouncyCastle,
      "org.bouncycastle" % "bcpkix-jdk18on" % Versions.bouncyCastle,
      "org.bouncycastle" % "bcprov-jdk18on" % Versions.bouncyCastle
    )
    val snakeyaml = "org.yaml" % "snakeyaml" % Versions.snakeyaml

  }

  object Test {
    def bouncyCastle: Seq[ModuleID] = Compile.bouncyCastle.map(_ % "test")
    val scalatest: ModuleID = "org.scalatest" %% "scalatest" % Versions.scalatest % "test"
    val scalacheck: ModuleID = "org.scalacheck" %% "scalacheck" % Versions.scalacheck % "test"
  }
}
