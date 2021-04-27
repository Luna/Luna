package org.enso.languageserver.boot.resource

import java.io.File
import java.nio.file.{Files, StandardOpenOption}
import java.util.UUID

import akka.actor.ActorSystem
import akka.testkit._
import org.apache.commons.io.FileUtils
import org.enso.languageserver.data._
import org.enso.languageserver.event.InitializedEvent
import org.enso.searcher.sql.{
  SchemaVersion,
  SqlDatabase,
  SqlSuggestionsRepo,
  SqlVersionsRepo
}
import org.enso.testkit.RetrySpec
import org.scalatest.BeforeAndAfterAll
import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpecLike
import org.sqlite.SQLiteException

import scala.concurrent.Await
import scala.concurrent.duration._

class RepoInitializationSpec
    extends TestKit(ActorSystem("TestSystem"))
    with ImplicitSender
    with AnyWordSpecLike
    with Matchers
    with BeforeAndAfterAll
    with RetrySpec {

  import system.dispatcher

  val Timeout: FiniteDuration = 10.seconds.dilated

  override def afterAll(): Unit = {
    TestKit.shutdownActorSystem(system)
  }

  "RepoInitialization" should {

    "initialize repositories" in withDb {
      (config, suggestionsRepo, versionsRepo) =>
        system.eventStream.subscribe(self, classOf[InitializedEvent])

        val component =
          new RepoInitialization(
            config.directories,
            system.eventStream,
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
          InitializedEvent.FileVersionsRepoInitialized
        )
    }

    "recreate suggestion database when schema version is incorrect" in withDb {
      (config, suggestionsRepo, versionsRepo) =>
        system.eventStream.subscribe(self, classOf[InitializedEvent])

        val testSchemaVersion = Long.MaxValue
        val component =
          new RepoInitialization(
            config.directories,
            system.eventStream,
            suggestionsRepo,
            versionsRepo
          )

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
          InitializedEvent.FileVersionsRepoInitialized
        )
    }

    "recreate suggestion database when schema version is empty" in withDb {
      (config, suggestionsRepo, versionsRepo) =>
        system.eventStream.subscribe(self, classOf[InitializedEvent])

        val component =
          new RepoInitialization(
            config.directories,
            system.eventStream,
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
          InitializedEvent.FileVersionsRepoInitialized
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
          InitializedEvent.FileVersionsRepoInitialized
        )
    }

    "recreate corrupted suggestion database file" in withDb {
      (config, suggestionsRepo, versionsRepo) =>
        system.eventStream.subscribe(self, classOf[InitializedEvent])

        val component =
          new RepoInitialization(
            config.directories,
            system.eventStream,
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
          InitializedEvent.FileVersionsRepoInitialized
        )

        // corrupt
        val bytes: Array[Byte] = Array(1, 2, 3)
        Files.write(
          config.directories.suggestionsDatabaseFile.toPath,
          bytes,
          StandardOpenOption.WRITE,
          StandardOpenOption.TRUNCATE_EXISTING,
          StandardOpenOption.SYNC
        )
        an[SQLiteException] should be thrownBy Await.result(
          suggestionsRepo.getSchemaVersion,
          Timeout
        )

        // re-initialize
        val action =
          for {
            _       <- component.init()
            version <- suggestionsRepo.getSchemaVersion
          } yield version

        val version2 = Await.result(action, Timeout)
        version2 shouldEqual SchemaVersion.CurrentVersion
        expectMsgAllOf(
          InitializedEvent.SuggestionsRepoInitialized,
          InitializedEvent.FileVersionsRepoInitialized
        )
    }

  }

  def newConfig(root: File): Config = {
    Config(
      Map(UUID.randomUUID() -> root),
      FileManagerConfig(timeout = 3.seconds.dilated),
      PathWatcherConfig(),
      ExecutionContextConfig(requestTimeout = 3.seconds.dilated),
      DirectoriesConfig.initialize(root)
    )
  }

  def withDb(
    test: (
      Config,
      SqlSuggestionsRepo,
      SqlVersionsRepo
    ) => Any
  ): Unit = {
    val testContentRoot = Files.createTempDirectory(null).toRealPath()
    sys.addShutdownHook(FileUtils.deleteQuietly(testContentRoot.toFile))
    val config = newConfig(testContentRoot.toFile)
    val sqlDatabase = SqlDatabase(
      config.directories.suggestionsDatabaseFile.toString
    )
    val suggestionsRepo = new SqlSuggestionsRepo(sqlDatabase)
    val versionsRepo    = new SqlVersionsRepo(sqlDatabase)

    try test(config, suggestionsRepo, versionsRepo)
    finally {
      sqlDatabase.close()
    }
  }
}
