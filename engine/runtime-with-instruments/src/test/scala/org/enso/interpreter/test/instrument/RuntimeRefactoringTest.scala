package org.enso.interpreter.test.instrument

import org.apache.commons.io.output.TeeOutputStream
import org.enso.distribution.FileSystem
import org.enso.distribution.locking.ThreadSafeFileLockManager
import org.enso.interpreter.runtime.`type`.ConstantsGen
import org.enso.interpreter.test.Metadata
import org.enso.pkg.{Package, PackageManager}
import org.enso.polyglot._
import org.enso.polyglot.runtime.Runtime.Api
import org.enso.text.{ContentBasedVersioning, Sha3_224VersionCalculator}
import org.enso.text.editing.model
import org.enso.text.editing.model.TextEdit
import org.graalvm.polyglot.Context
import org.scalatest.BeforeAndAfterEach
import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers

import java.io.{ByteArrayOutputStream, File}
import java.nio.file.{Files, Path, Paths}
import java.util.UUID

@scala.annotation.nowarn("msg=multiarg infix syntax")
class RuntimeRefactoringTest
    extends AnyFlatSpec
    with Matchers
    with BeforeAndAfterEach {

  // === Test Utilities =======================================================

  var context: TestContext = _

  class TestContext(packageName: String) extends InstrumentTestContext {

    val tmpDir: Path = Files.createTempDirectory("enso-test-packages")
    sys.addShutdownHook(FileSystem.removeDirectoryIfExists(tmpDir))
    val lockManager = new ThreadSafeFileLockManager(tmpDir.resolve("locks"))
    val runtimeServerEmulator =
      new RuntimeServerEmulator(messageQueue, lockManager)

    val pkg: Package[File] =
      PackageManager.Default.create(tmpDir.toFile, packageName, "Enso_Test")
    val out: ByteArrayOutputStream    = new ByteArrayOutputStream()
    val logOut: ByteArrayOutputStream = new ByteArrayOutputStream()
    val executionContext = new PolyglotContext(
      Context
        .newBuilder(LanguageInfo.ID)
        .allowExperimentalOptions(true)
        .allowAllAccess(true)
        .option(RuntimeOptions.PROJECT_ROOT, pkg.root.getAbsolutePath)
        .option(RuntimeOptions.LOG_LEVEL, "WARNING")
        .option(RuntimeOptions.INTERPRETER_SEQUENTIAL_COMMAND_EXECUTION, "true")
        .option(RuntimeOptions.ENABLE_PROJECT_SUGGESTIONS, "false")
        .option(RuntimeOptions.ENABLE_GLOBAL_SUGGESTIONS, "false")
        .option(RuntimeOptions.ENABLE_EXECUTION_TIMER, "false")
        .option(
          RuntimeOptions.DISABLE_IR_CACHES,
          InstrumentTestContext.DISABLE_IR_CACHE
        )
        .option(RuntimeServerInfo.ENABLE_OPTION, "true")
        .option(RuntimeOptions.INTERACTIVE_MODE, "true")
        .option(
          RuntimeOptions.LANGUAGE_HOME_OVERRIDE,
          Paths
            .get("../../test/micro-distribution/component")
            .toFile
            .getAbsolutePath
        )
        .option(RuntimeOptions.EDITION_OVERRIDE, "0.0.0-dev")
        .logHandler(new TeeOutputStream(logOut, System.err))
        .out(new TeeOutputStream(out, System.err))
        .serverTransport(runtimeServerEmulator.makeServerTransport)
        .build()
    )
    executionContext.context.initialize(LanguageInfo.ID)

    def writeMain(contents: String): File =
      Files.write(pkg.mainFile.toPath, contents.getBytes).toFile

    def readMain: String =
      Files.readString(pkg.mainFile.toPath)

    def send(msg: Api.Request): Unit = runtimeServerEmulator.sendToRuntime(msg)

    def consumeOut: List[String] = {
      val result = out.toString
      out.reset()
      result.linesIterator.toList
    }

    def executionComplete(contextId: UUID): Api.Response =
      Api.Response(Api.ExecutionComplete(contextId))
  }

  val versionCalculator: ContentBasedVersioning = Sha3_224VersionCalculator

  override protected def beforeEach(): Unit = {
    context = new TestContext("Test")
    val Some(Api.Response(_, Api.InitializedNotification())) = context.receive
  }

  override protected def afterEach(): Unit = {
    context.executionContext.context.close()
    context.runtimeServerEmulator.terminate()
  }

  "RuntimeServer" should "rename operator in main body" in {
    val contextId  = UUID.randomUUID()
    val requestId  = UUID.randomUUID()
    val moduleName = "Enso_Test.Test.Main"

    val metadata    = new Metadata
    val idOperator1 = metadata.addItem(42, 9)
    val code =
      """from Standard.Base import all
        |
        |main =
        |    operator1 = 41
        |    operator2 = operator1 + 1
        |    IO.println operator2
        |""".stripMargin.linesIterator.mkString("\n")
    val contents = metadata.appendToCode(code)
    val mainFile = context.writeMain(contents)

    // create context
    context.send(Api.Request(requestId, Api.CreateContextRequest(contextId)))
    context.receive shouldEqual Some(
      Api.Response(requestId, Api.CreateContextResponse(contextId))
    )

    // open file
    context.send(
      Api.Request(Api.OpenFileNotification(mainFile, contents))
    )
    context.receiveNone shouldEqual None

    // push main
    context.send(
      Api.Request(
        requestId,
        Api.PushContextRequest(
          contextId,
          Api.StackItem.ExplicitCall(
            Api.MethodPointer(moduleName, moduleName, "main"),
            None,
            Vector()
          )
        )
      )
    )

    context.receiveNIgnoreStdLib(3) should contain theSameElementsAs Seq(
      Api.Response(Api.BackgroundJobsStartedNotification()),
      Api.Response(requestId, Api.PushContextResponse(contextId)),
      context.executionComplete(contextId)
    )
    context.consumeOut shouldEqual List("42")

    // rename operator1
    val newName = "foobarbaz"
    val expectedEdits = Vector(
      TextEdit(
        model.Range(model.Position(3, 4), model.Position(3, 13)),
        newName
      ),
      TextEdit(
        model.Range(model.Position(4, 16), model.Position(4, 25)),
        newName
      )
    )
    val expectedFileEdit = Api.FileEdit(
      context.pkg.mainFile,
      expectedEdits,
      versionCalculator.evalVersion(contents).toHexString,
      versionCalculator
        .evalVersion(contents.replaceAll("operator1", newName))
        .toHexString
    )
    context.send(
      Api.Request(requestId, Api.RenameSymbol(moduleName, idOperator1, newName))
    )
    context.receiveNIgnoreStdLib(4) should contain theSameElementsAs Seq(
      Api.Response(requestId, Api.SymbolRenamed(newName)),
      Api.Response(None, expectedFileEdit),
      TestMessages.pending(contextId, idOperator1),
      context.executionComplete(contextId)
    )
    context.consumeOut shouldEqual List("42")
  }

  it should "rename operator in lambda expression" in {
    val contextId  = UUID.randomUUID()
    val requestId  = UUID.randomUUID()
    val moduleName = "Enso_Test.Test.Main"

    val metadata    = new Metadata
    val idOperator1 = metadata.addItem(42, 9)
    val code =
      """from Standard.Base import all
        |
        |main =
        |    operator1 = 41
        |    operator2 = x-> operator1 + x
        |    IO.println (operator2 1)
        |""".stripMargin.linesIterator.mkString("\n")
    val contents = metadata.appendToCode(code)
    val mainFile = context.writeMain(contents)

    // create context
    context.send(Api.Request(requestId, Api.CreateContextRequest(contextId)))
    context.receive shouldEqual Some(
      Api.Response(requestId, Api.CreateContextResponse(contextId))
    )

    // open file
    context.send(
      Api.Request(Api.OpenFileNotification(mainFile, contents))
    )
    context.receiveNone shouldEqual None

    // push main
    context.send(
      Api.Request(
        requestId,
        Api.PushContextRequest(
          contextId,
          Api.StackItem.ExplicitCall(
            Api.MethodPointer(moduleName, moduleName, "main"),
            None,
            Vector()
          )
        )
      )
    )

    context.receiveNIgnoreStdLib(3) should contain theSameElementsAs Seq(
      Api.Response(Api.BackgroundJobsStartedNotification()),
      Api.Response(requestId, Api.PushContextResponse(contextId)),
      context.executionComplete(contextId)
    )
    context.consumeOut shouldEqual List("42")

    // rename operator1
    val newName = "foobarbaz"
    val expectedEdits = Vector(
      TextEdit(
        model.Range(model.Position(3, 4), model.Position(3, 13)),
        newName
      ),
      TextEdit(
        model.Range(model.Position(4, 20), model.Position(4, 29)),
        newName
      )
    )
    val expectedFileEdit = Api.FileEdit(
      context.pkg.mainFile,
      expectedEdits,
      versionCalculator.evalVersion(contents).toHexString,
      versionCalculator
        .evalVersion(contents.replaceAll("operator1", newName))
        .toHexString
    )
    context.send(
      Api.Request(requestId, Api.RenameSymbol(moduleName, idOperator1, newName))
    )
    context.receiveNIgnoreStdLib(4) should contain theSameElementsAs Seq(
      Api.Response(requestId, Api.SymbolRenamed(newName)),
      Api.Response(None, expectedFileEdit),
      TestMessages.pending(contextId, idOperator1),
      context.executionComplete(contextId)
    )
    context.consumeOut shouldEqual List("42")
  }

  it should "edit file after renaming" in {
    val contextId  = UUID.randomUUID()
    val requestId  = UUID.randomUUID()
    val moduleName = "Enso_Test.Test.Main"

    val metadata        = new Metadata
    val symbolOperator1 = metadata.addItem(42, 9, "aa")
    val exprOperator1   = metadata.addItem(54, 2, "ab")
    val exprOperator2   = metadata.addItem(73, 13, "ac")
    val code =
      """from Standard.Base import all
        |
        |main =
        |    operator1 = 41
        |    operator2 = operator1 + 1
        |    IO.println operator2
        |""".stripMargin.linesIterator.mkString("\n")
    val contents = metadata.appendToCode(code)
    val mainFile = context.writeMain(contents)

    // create context
    context.send(Api.Request(requestId, Api.CreateContextRequest(contextId)))
    context.receive shouldEqual Some(
      Api.Response(requestId, Api.CreateContextResponse(contextId))
    )

    // open file
    context.send(
      Api.Request(Api.OpenFileNotification(mainFile, contents))
    )
    context.receiveNone shouldEqual None

    // push main
    context.send(
      Api.Request(
        requestId,
        Api.PushContextRequest(
          contextId,
          Api.StackItem.ExplicitCall(
            Api.MethodPointer(moduleName, moduleName, "main"),
            None,
            Vector()
          )
        )
      )
    )

    context.receiveNIgnoreStdLib(5) should contain theSameElementsAs Seq(
      Api.Response(Api.BackgroundJobsStartedNotification()),
      Api.Response(requestId, Api.PushContextResponse(contextId)),
      TestMessages.update(contextId, exprOperator1, ConstantsGen.INTEGER),
      TestMessages.update(contextId, exprOperator2, ConstantsGen.INTEGER),
      context.executionComplete(contextId)
    )
    context.consumeOut shouldEqual List("42")

    // rename operator1
    val newName = "foobarbaz"
    val expectedEdits = Vector(
      TextEdit(
        model.Range(model.Position(3, 4), model.Position(3, 13)),
        newName
      ),
      TextEdit(
        model.Range(model.Position(4, 16), model.Position(4, 25)),
        newName
      )
    )
    val expectedFileEdit = Api.FileEdit(
      context.pkg.mainFile,
      expectedEdits,
      versionCalculator.evalVersion(contents).toHexString,
      versionCalculator
        .evalVersion(contents.replaceAll("operator1", newName))
        .toHexString
    )
    context.send(
      Api.Request(
        requestId,
        Api.RenameSymbol(moduleName, symbolOperator1, newName)
      )
    )
    context.receiveNIgnoreStdLib(5) should contain theSameElementsAs Seq(
      Api.Response(requestId, Api.SymbolRenamed(newName)),
      Api.Response(None, expectedFileEdit),
      TestMessages.pending(contextId, symbolOperator1, exprOperator2),
      TestMessages.update(
        contextId,
        exprOperator2,
        ConstantsGen.INTEGER,
        typeChanged = false
      ),
      context.executionComplete(contextId)
    )
    context.consumeOut shouldEqual List("42")

    // modify main
    context.send(
      Api.Request(
        Api.EditFileNotification(
          mainFile,
          Seq(
            TextEdit(
              model.Range(model.Position(3, 16), model.Position(3, 18)),
              "42"
            )
          ),
          execute = true
        )
      )
    )
    context.receiveN(4) should contain theSameElementsAs Seq(
      TestMessages.pending(contextId, exprOperator1, exprOperator2),
      TestMessages
        .update(
          contextId,
          exprOperator1,
          ConstantsGen.INTEGER,
          typeChanged = false
        ),
      TestMessages
        .update(
          contextId,
          exprOperator2,
          ConstantsGen.INTEGER,
          typeChanged = false
        ),
      context.executionComplete(contextId)
    )
    context.consumeOut shouldEqual List("43")
  }

  it should "fail with ExpressionNotFound when renaming non-existent symbol" in {
    val contextId  = UUID.randomUUID()
    val requestId  = UUID.randomUUID()
    val moduleName = "Enso_Test.Test.Main"

    val metadata = new Metadata
    val code =
      """from Standard.Base import all
        |
        |main =
        |    operator1 = 41
        |    operator2 = operator1 + 1
        |    IO.println operator2
        |""".stripMargin.linesIterator.mkString("\n")
    val contents = metadata.appendToCode(code)
    val mainFile = context.writeMain(contents)

    // create context
    context.send(Api.Request(requestId, Api.CreateContextRequest(contextId)))
    context.receive shouldEqual Some(
      Api.Response(requestId, Api.CreateContextResponse(contextId))
    )

    // open file
    context.send(
      Api.Request(Api.OpenFileNotification(mainFile, contents))
    )
    context.receiveNone shouldEqual None

    // push main
    context.send(
      Api.Request(
        requestId,
        Api.PushContextRequest(
          contextId,
          Api.StackItem.ExplicitCall(
            Api.MethodPointer(moduleName, moduleName, "main"),
            None,
            Vector()
          )
        )
      )
    )

    context.receiveNIgnoreStdLib(3) should contain theSameElementsAs Seq(
      Api.Response(Api.BackgroundJobsStartedNotification()),
      Api.Response(requestId, Api.PushContextResponse(contextId)),
      context.executionComplete(contextId)
    )
    context.consumeOut shouldEqual List("42")

    // rename operator1
    val randomExpressionId = UUID.randomUUID()
    val newName            = "foobarbaz"
    context.send(
      Api.Request(
        requestId,
        Api.RenameSymbol(moduleName, randomExpressionId, newName)
      )
    )
    context.receiveNIgnoreStdLib(1) should contain theSameElementsAs Seq(
      Api.Response(
        requestId,
        Api.SymbolRenameFailed(
          Api.SymbolRenameFailed.ExpressionNotFound(randomExpressionId)
        )
      )
    )
    context.consumeOut shouldEqual List()
  }

  it should "fail with OperationNotSupported when renaming an expression" in {
    val contextId  = UUID.randomUUID()
    val requestId  = UUID.randomUUID()
    val moduleName = "Enso_Test.Test.Main"

    val metadata      = new Metadata
    val exprOperator1 = metadata.addItem(54, 2)
    val code =
      """from Standard.Base import all
        |
        |main =
        |    operator1 = 41
        |    operator2 = operator1 + 1
        |    IO.println operator2
        |""".stripMargin.linesIterator.mkString("\n")
    val contents = metadata.appendToCode(code)
    val mainFile = context.writeMain(contents)

    // create context
    context.send(Api.Request(requestId, Api.CreateContextRequest(contextId)))
    context.receive shouldEqual Some(
      Api.Response(requestId, Api.CreateContextResponse(contextId))
    )

    // open file
    context.send(
      Api.Request(Api.OpenFileNotification(mainFile, contents))
    )
    context.receiveNone shouldEqual None

    // push main
    context.send(
      Api.Request(
        requestId,
        Api.PushContextRequest(
          contextId,
          Api.StackItem.ExplicitCall(
            Api.MethodPointer(moduleName, moduleName, "main"),
            None,
            Vector()
          )
        )
      )
    )

    context.receiveNIgnoreStdLib(4) should contain theSameElementsAs Seq(
      Api.Response(Api.BackgroundJobsStartedNotification()),
      Api.Response(requestId, Api.PushContextResponse(contextId)),
      TestMessages.update(contextId, exprOperator1, ConstantsGen.INTEGER),
      context.executionComplete(contextId)
    )
    context.consumeOut shouldEqual List("42")

    // rename operator1
    val newName = "foobarbaz"
    context.send(
      Api.Request(
        requestId,
        Api.RenameSymbol(moduleName, exprOperator1, newName)
      )
    )
    context.receiveNIgnoreStdLib(1) should contain theSameElementsAs Seq(
      Api.Response(
        requestId,
        Api.SymbolRenameFailed(
          Api.SymbolRenameFailed.OperationNotSupported(exprOperator1)
        )
      )
    )
    context.consumeOut shouldEqual List()
  }
}
