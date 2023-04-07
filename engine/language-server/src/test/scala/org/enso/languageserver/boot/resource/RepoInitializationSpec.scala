package org.enso.languageserver.boot.resource

import akka.actor.ActorSystem
import akka.testkit._
import org.apache.commons.io.FileUtils
import org.enso.languageserver.boot.{ProfilingConfig, StartupConfig}
import org.enso.languageserver.data._
import org.enso.languageserver.event.InitializedEvent
import org.enso.languageserver.filemanager.{ContentRoot, ContentRootWithFile}
import org.enso.searcher.sql.{
  SchemaVersion,
  SqlDatabase,
  SqlSuggestionsRepo,
  SqlVersionsRepo
}
import org.enso.testkit.FlakySpec
import org.scalatest.BeforeAndAfterAll
import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpecLike
import org.sqlite.SQLiteException

import java.nio.file.{Files, StandardOpenOption}
import java.util.UUID
import scala.concurrent.Await
import scala.concurrent.duration._

class RepoInitializationSpec
    extends TestKit(ActorSystem("TestSystem"))
    with ImplicitSender
    with AnyWordSpecLike
    with Matchers
    with BeforeAndAfterAll
    with FlakySpec {

  import system.dispatcher

  val Timeout: FiniteDuration = 10.seconds.dilated

  override def afterAll(): Unit = {
    TestKit.shutdownActorSystem(system)
  }

  "RepoInitialization" should {

    "initialize repositories" in withDb {
      (config, sqlDatabase, suggestionsRepo, versionsRepo) =>
        system.eventStream.subscribe(self, classOf[InitializedEvent])

        val component =
          new RepoInitialization(
            config.directories,
            system.eventStream,
            sqlDatabase,
            suggestionsRepo,
            versionsRepo
          )

        val action =
          for {
            _             <- component.init()
            schemaVersion <- suggestionsRepo.getSchemaVersion
          } yield schemaVersion

        val version = Await.result(action, Timeout)
        version shouldEqual SchemaVersion.CurrentVersion

        expectMsgAllOf(
          InitializedEvent.SuggestionsRepoInitialized,
          InitializedEvent.VersionsRepoInitialized
        )
    }

    "recreate suggestion database when schema version is incorrect" in withDb {
      (config, sqlDatabase, suggestionsRepo, versionsRepo) =>
        system.eventStream.subscribe(self, classOf[InitializedEvent])

        val testSchemaVersion = Long.MaxValue
        val component =
          new RepoInitialization(
            config.directories,
            system.eventStream,
            sqlDatabase,
            suggestionsRepo,
            versionsRepo
          )

        sqlDatabase.open()

        val action =
          for {
            _       <- suggestionsRepo.init
            _       <- suggestionsRepo.setSchemaVersion(testSchemaVersion)
            _       <- component.init()
            version <- suggestionsRepo.getSchemaVersion
          } yield version

        val version = Await.result(action, Timeout)
        version shouldEqual SchemaVersion.CurrentVersion

        expectMsgAllOf(
          InitializedEvent.SuggestionsRepoInitialized,
          InitializedEvent.VersionsRepoInitialized
        )
    }

    "recreate suggestion database when schema version is empty" in withDb {
      (config, sqlDatabase, suggestionsRepo, versionsRepo) =>
        system.eventStream.subscribe(self, classOf[InitializedEvent])

        val component =
          new RepoInitialization(
            config.directories,
            system.eventStream,
            sqlDatabase,
            suggestionsRepo,
            versionsRepo
          )

        // initialize
        val init =
          for {
            _       <- component.init()
            version <- suggestionsRepo.getSchemaVersion
          } yield version

        val version1 = Await.result(init, Timeout)
        version1 shouldEqual SchemaVersion.CurrentVersion
        expectMsgAllOf(
          InitializedEvent.SuggestionsRepoInitialized,
          InitializedEvent.VersionsRepoInitialized
        )

        // remove schema and re-initialize
        val action =
          for {
            _       <- suggestionsRepo.clearSchemaVersion
            _       <- component.init()
            version <- suggestionsRepo.getSchemaVersion
          } yield version

        val version2 = Await.result(action, Timeout)
        version2 shouldEqual SchemaVersion.CurrentVersion
        expectMsgAllOf(
          InitializedEvent.SuggestionsRepoInitialized,
          InitializedEvent.VersionsRepoInitialized
        )
    }

    "recreate corrupted suggestion database file" taggedAs Flaky in withConfig {
      config =>
        // initialize
        withRepos(config) { (sqlDatabase, suggestionsRepo, versionsRepo) =>
          val component =
            new RepoInitialization(
              config.directories,
              system.eventStream,
              sqlDatabase,
              suggestionsRepo,
              versionsRepo
            )

          val init =
            for {
              _       <- component.init()
              version <- suggestionsRepo.getSchemaVersion
            } yield version

          val version1 = Await.result(init, Timeout)
          version1 shouldEqual SchemaVersion.CurrentVersion
        }

        // corrupt
        val bytes: Array[Byte] = Array(1, 2, 3)
        Files.delete(config.directories.suggestionsDatabaseFile.toPath)
        Files.write(
          config.directories.suggestionsDatabaseFile.toPath,
          bytes,
          StandardOpenOption.CREATE
        )
        withRepos(config) { (sqlDatabase, suggestionsRepo, _) =>
          sqlDatabase.open()
          an[SQLiteException] should be thrownBy Await.result(
            suggestionsRepo.getSchemaVersion,
            Timeout
          )
        }

        // re-initialize
        withRepos(config) { (sqlDatabase, suggestionsRepo, versionsRepo) =>
          val component =
            new RepoInitialization(
              config.directories,
              system.eventStream,
              sqlDatabase,
              suggestionsRepo,
              versionsRepo
            )

          val action =
            for {
              _       <- component.init()
              version <- suggestionsRepo.getSchemaVersion
            } yield version

          val version2 = Await.result(action, Timeout)
          version2 shouldEqual SchemaVersion.CurrentVersion
          expectMsgAllOf(
            InitializedEvent.SuggestionsRepoInitialized,
            InitializedEvent.VersionsRepoInitialized
          )
        }
    }

  }

  def newConfig(root: ContentRootWithFile): Config = {
    Config(
      root,
      FileManagerConfig(timeout = 3.seconds.dilated),
      VcsManagerConfig(),
      PathWatcherConfig(),
      ExecutionContextConfig(requestTimeout = 3.seconds.dilated),
      ProjectDirectoriesConfig.initialize(root.file),
      ProfilingConfig(),
      StartupConfig(),
      None
    )
  }

  def withConfig(test: Config => Any): Unit = {
    val testContentRoot = Files.createTempDirectory(null).toRealPath()
    sys.addShutdownHook(FileUtils.deleteQuietly(testContentRoot.toFile))
    val config = newConfig(
      ContentRootWithFile(
        ContentRoot.Project(UUID.randomUUID()),
        testContentRoot.toFile
      )
    )

    test(config)
  }

  def withRepos(
    config: Config
  )(test: (SqlDatabase, SqlSuggestionsRepo, SqlVersionsRepo) => Any): Unit = {
    val sqlDatabase     = SqlDatabase(config.directories.suggestionsDatabaseFile)
    val suggestionsRepo = new SqlSuggestionsRepo(sqlDatabase)
    val versionsRepo    = new SqlVersionsRepo(sqlDatabase)

    try test(sqlDatabase, suggestionsRepo, versionsRepo)
    finally {
      sqlDatabase.close()
    }
  }

  def withDb(
    test: (
      Config,
      SqlDatabase,
      SqlSuggestionsRepo,
      SqlVersionsRepo
    ) => Any
  ): Unit = {
    withConfig { config =>
      withRepos(config) { (sqlDatabase, suggestionsRepo, versionsRepo) =>
        test(config, sqlDatabase, suggestionsRepo, versionsRepo)
      }
    }
  }
}
