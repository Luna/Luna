import sbt._

object Dependencies {

  val dependencyUpgradeModuleNames = Map(
    "circe-core" -> "circe",
    "slf4j-simple" -> "slf4j"
  )

  /** Manually updated versions. */
  object VersionsPinned {
    // Akka
    val akkaActor = "2.6.20"
    val akkaHttp = "10.2.10"
    val javaDiffUtils = "4.12"
    val protobufJava = "3.25.1"
    val reactiveStreams = "1.0.3"
    val scalaParserCombinators = "1.1.2"
    val sprayJson = "1.3.6"
    // jaxb
    val jaxbVersion = "4.0.0"
    // GraalVM
    val graalMavenPackages = "24.0.0"
    // Scala
    val scala = "2.13.15"
  }

  /** Versions updated automatically by running the `dependencyUpgrade` command.
    *
    * Manual interventions after update:
    *   - slf4jApi : update module `org.enso.truffleloggerwrapper.TruffleLoggerWrapperProvider`
    */
  object Versions {
    val akkaActor = "2.8.8"
    val akkaHttp = "10.5.3"
    val akkaHttpCore = "10.5.3"
    val akkaHttpSprayJson = "10.5.3"
    val akkaParsing = "10.5.3"
    val akkaProtobufV3 = "2.8.8"
    val akkaSlf4j = "2.8.8"
    val akkaStream = "2.8.8"
    val arrowVector = "14.0.1"
    val arrowMemoryNetty = "14.0.1"
    val bcutilJdk18on = "1.76"
    val bcpkixJdk18on = "1.76"
    val bcprovJdk18on = "1.76"
    val catsCore = "2.12.0"
    val catsKernel = "2.10.0"
    val circeCore = "0.14.10"
    val circeGeneric = "0.14.10"
    val circeJawn = "0.14.10"
    val circeNumbers = "0.14.10"
    val circeParser = "0.14.10"
    val collections = "24.1.1"
    val commonsCli = "1.5.0"
    val commonsCodec = "1.17.1"
    val commonsCollections4 = "4.4"
    val commonsCompress = "1.23.0"
    val commonsIo = "2.12.0"
    val commonsLang3 = "3.12.0"
    val commonsMath3 = "3.6.1"
    val commonsText = "1.10.0"
    val config = "1.4.3"
    val directoryWatcher = "0.18.0"
    val fansi = "0.5.0"
    val flatbuffersJava = "24.3.25"
    val guava = "33.3.1-jre"
    val hamcrestAll = "1.3"
    val httpclient = "4.5.14"
    val icu4j = "73.1"
    val jacksonDatabind = "2.18.2"
    val javaDiffUtils = "4.15"
    val jline = "3.27.1"
    val jmhCore = "1.36"
    val jmhGeneratorAnnprocess = "1.36"
    val jna = "5.15.0"
    val jniutils = "24.1.1"
    val jsoniterScalaCore = "2.31.3"
    val jsoniterScalaMacros = "2.31.3"
    val junit = "4.13.2"
    val junitInterface = "0.13.3"
    val logbackClassic = "1.5.12"
    val logbackCore = "1.5.12"
    val nativeimage = "24.1.1"
    val orgEclipseJgit = "6.7.0.202309050840-r"
    val orgNetbeansModulesSampler = "RELEASE230"
    val orgOpenideUtilLookup = "RELEASE230"
    val polyglot = "24.1.1"
    val polyglotTck = "24.1.1"
    val protobufJava = "4.29.1"
    val pureconfig = "0.17.4"
    val pureconfigCore = "0.17.4"
    val pureconfigGeneric = "0.17.4"
    val reactiveStreams = "1.0.4"
    val scalaCompiler = "2.13.15"
    val scalaJava8Compat = "1.0.2"
    val scalaLogging = "3.9.5"
    val scalaParserCombinators = "2.4.0"
    val scalacheck = "1.18.1"
    val scalactic = "3.2.19"
    val scalatest = "3.2.19"
    val sentry = "7.18.1"
    val sentryLogback = "7.18.1"
    val shapeless = "2.3.12"
    val slf4jApi = "2.0.16"
    val slf4jNop = "2.0.16"
    val snakeyaml = "2.3"
    val sprayJson = "1.3.6"
    val svm = "24.1.1"
    val tikaCore = "2.4.1"
    val truffleApi = "24.1.1"
    val truffleCompiler = "24.1.1"
    val truffleDslProcessor = "24.1.1"
    val truffleRuntime = "24.1.1"
    val word = "24.1.1"
    val zio = "2.0.14"
    val zioInteropCats = "23.0.0.6"
  }

  object Pinned {
    // io.methvin % directory-watcher % 0.18.0
    val `slf4jApi-1.7.36` = "org.slf4j" % "slf4j-api" % "1.7.36"
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
    val akkaActor = "com.typesafe.akka" %% "akka-actor" % VersionsPinned.akkaActor
    val akkaHttp = "com.typesafe.akka" %% "akka-http" % VersionsPinned.akkaHttp
    val akkaHttpCore = "com.typesafe.akka" %% "akka-http-core" % VersionsPinned.akkaHttp
    val akkaSlf4j = "com.typesafe.akka" %% "akka-slf4j" % VersionsPinned.akkaActor
    val akkaStream = "com.typesafe.akka" %% "akka-stream" % VersionsPinned.akkaActor
    val akkaParsing = "com.typesafe.akka" %% "akka-parsing" % VersionsPinned.akkaHttp
    val akkaProtobufV3 = "com.typesafe.akka" %% "akka-protobuf-v3" % VersionsPinned.akkaActor
    val akkaHttpSprayJson = "com.typesafe.akka" %% "akka-http-spray-json" % VersionsPinned.akkaHttp
    val apacheArrowVector = "org.apache.arrow" % "arrow-vector" % Versions.arrowVector
    val apacheArrowMemoryNetty = "org.apache.arrow" % "arrow-memory-netty" % Versions.arrowMemoryNetty
    val apacheHttpclient = "org.apache.httpcomponents" % "httpclient" % Versions.httpclient
    val bouncycastleBcutil = "org.bouncycastle" % "bcutil-jdk18on" % Versions.bcutilJdk18on
    val bouncycastleBcpkix = "org.bouncycastle" % "bcpkix-jdk18on" % Versions.bcpkixJdk18on
    val bouncycastleBcprov = "org.bouncycastle" % "bcprov-jdk18on" % Versions.bcprovJdk18on
    val catsCore = "org.typelevel" %% "cats-core" % Versions.catsCore
    val catsKernel = "org.typelevel" %% "cats-kernel" % Versions.catsKernel
    val circeGeneric = "io.circe" %% "circe-generic" % Versions.circeGeneric
    val circeCore = "io.circe" %% "circe-core" % Versions.circeCore
    val circeParser = "io.circe" %% "circe-parser" % Versions.circeParser
    val circeJawn = "io.circe" %% "circe-jawn" % Versions.circeJawn
    val circeNumbers = "io.circe" %% "circe-numbers" % Versions.circeNumbers
    val commonsCli = "commons-cli" % "commons-cli" % Versions.commonsCli
    val commonsCodec = "commons-codec" % "commons-codec" % Versions.commonsCodec
    val commonsCollections4 = "org.apache.commons" % "commons-collections4" % Versions.commonsCollections4
    val commonsCompress = "org.apache.commons" % "commons-compress" % Versions.commonsCompress
    val commonsIo = "commons-io" % "commons-io" % Versions.commonsIo
    val commonsLang3 = "org.apache.commons" % "commons-lang3" % Versions.commonsLang3
    val commonsMath3 = "org.apache.commons" % "commons-math3" % Versions.commonsMath3
    val commonsText = "org.apache.commons" % "commons-text" % Versions.commonsText
    val directoryWatcher = "io.methvin" % "directory-watcher" % Versions.directoryWatcher
    val eclipseJgit = "org.eclipse.jgit" % "org.eclipse.jgit" % Versions.orgEclipseJgit
    val fansi = "com.lihaoyi" %% "fansi" % Versions.fansi
    val flatbuffersJava = "com.google.flatbuffers" % "flatbuffers-java" % Versions.flatbuffersJava
    val graalvmCollections = "org.graalvm.sdk" % "collections" % VersionsPinned.graalMavenPackages
    val graalvmJsCommunity = "org.graalvm.polyglot" % "js-community" % VersionsPinned.graalMavenPackages
    val graalvmInspectCommunity = "org.graalvm.polyglot" % "inspect-community" % VersionsPinned.graalMavenPackages
    val graalvmNativeimage = "org.graalvm.sdk" % "nativeimage" % VersionsPinned.graalMavenPackages
    val graalvmPolyglot = "org.graalvm.polyglot" % "polyglot" % VersionsPinned.graalMavenPackages
    val graalvmPolyglotTck = "org.graalvm.sdk" % "polyglot-tck" % VersionsPinned.graalMavenPackages
    val graalvmRegex = "org.graalvm.regex" % "regex" % VersionsPinned.graalMavenPackages
    val graalvmTruffleApi = "org.graalvm.truffle" % "truffle-api" % VersionsPinned.graalMavenPackages
    val graalvmTruffleDslProcessor = "org.graalvm.truffle" % "truffle-dsl-processor" % VersionsPinned.graalMavenPackages
    val graalvmWord = "org.graalvm.sdk" % "word" % VersionsPinned.graalMavenPackages
    val guava = "com.google.guava" % "guava" % Versions.guava
    val hamcrestAll = "org.hamcrest" % "hamcrest-all" % Versions.hamcrestAll
    val jacksonDatabind = "com.fasterxml.jackson.core" % "jackson-databind" % Versions.jacksonDatabind
    val jakartaXmlBindApi = "jakarta.xml.bind" % "jakarta.xml.bind-api" % VersionsPinned.jaxbVersion
    val javaDiffUtils = "io.github.java-diff-utils" % "java-diff-utils" % VersionsPinned.javaDiffUtils
    val jaxbImpl = "com.sun.xml.bind" % "jaxb-impl" % VersionsPinned.jaxbVersion
    val jmhCore = "org.openjdk.jmh" % "jmh-core" % Versions.jmhCore
    val jmhGeneratorAnnprocess = "org.openjdk.jmh" % "jmh-generator-annprocess" % Versions.jmhGeneratorAnnprocess
    val icu4j = "com.ibm.icu" % "icu4j" % Versions.icu4j
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
    val protobufJava = "com.google.protobuf" % "protobuf-java" % VersionsPinned.protobufJava
    val pureconfig = "com.github.pureconfig" %% "pureconfig" % Versions.pureconfig
    val pureconfigCore = "com.github.pureconfig" %% "pureconfig-core" % Versions.pureconfigCore
    val pureconfigGeneric = "com.github.pureconfig" %% "pureconfig-generic" % Versions.pureconfigGeneric
    val reactiveStreams = "org.reactivestreams" % "reactive-streams" % VersionsPinned.reactiveStreams
    val sbtJunitInterface = "com.github.sbt" % "junit-interface" % Versions.junitInterface
    val scalacheck = "org.scalacheck" %% "scalacheck" % Versions.scalacheck
    val scalactic = "org.scalactic" %% "scalactic" % Versions.scalactic
    val scalaCompiler = "org.scala-lang" % "scala-compiler" % VersionsPinned.scala
    val scalaLibrary = "org.scala-lang" % "scala-library" % VersionsPinned.scala
    val scalaReflect = "org.scala-lang" % "scala-reflect" % VersionsPinned.scala
    val scalaLogging = "com.typesafe.scala-logging" %% "scala-logging" % Versions.scalaLogging
    val scalaParserCombinators =
      "org.scala-lang.modules" %% "scala-parser-combinators" % VersionsPinned.scalaParserCombinators
    val scalaJava8Compat = "org.scala-lang.modules" %% "scala-java8-compat" % Versions.scalaJava8Compat
    val scalatest = "org.scalatest" %% "scalatest" % Versions.scalatest
    val sentryLogback = "io.sentry" % "sentry-logback" % Versions.sentryLogback
    val sentry = "io.sentry" % "sentry" % Versions.sentry
    val shapeless = "com.chuusai" %% "shapeless" % Versions.shapeless
    val slf4jApi = "org.slf4j" % "slf4j-api" % Versions.slf4jApi
    val slf4jNop = "org.slf4j" % "slf4j-nop" % Versions.slf4jNop
    val snakeyaml = "org.yaml" % "snakeyaml" % Versions.snakeyaml
    val sprayJson = "io.spray" %% "spray-json" % VersionsPinned.sprayJson
    val tikaCore = "org.apache.tika" % "tika-core" % Versions.tikaCore
    val typesafeConfig = "com.typesafe" % "config" % Versions.config
    val zio = "dev.zio" %% "zio" % Versions.zio
    val zioInteropCats = "dev.zio" %% "zio-interop-cats" % Versions.zioInteropCats
  }

  object Test {
    val scalatest = "org.scalatest" %% "scalatest" % Versions.scalatest % "test"
    val scalacheck = "org.scalacheck" %% "scalacheck" % Versions.scalacheck % "test"
    val junit = "junit" % "junit" % Versions.junit % "test"
    val sbtJunitInterface = "com.github.sbt" % "junit-interface" % Versions.junitInterface % "test"
  }

  import Compile._
}
