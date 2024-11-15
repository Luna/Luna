package org.enso.interpreter.test.instrument

import org.apache.commons.io.output.TeeOutputStream
import org.enso.common.{LanguageInfo, MethodNames, RuntimeOptions}
import org.enso.interpreter.runtime.EnsoContext
import org.enso.interpreter.runtime.`type`.ConstantsGen
import org.enso.interpreter.test.Metadata
import org.enso.polyglot.RuntimeServerInfo
import org.enso.polyglot.runtime.Runtime.Api
import org.graalvm.polyglot.Context
import org.scalatest.BeforeAndAfterEach
import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers

import java.io.{ByteArrayOutputStream, File}
import java.nio.file.{Files, Paths}
import java.util.UUID

@scala.annotation.nowarn("msg=multiarg infix syntax")
class RuntimeIntersectionTypesTest
    extends AnyFlatSpec
    with Matchers
    with BeforeAndAfterEach {

  // === Test Utilities =======================================================

  var context: TestContext = _

  class TestContext(packageName: String)
      extends InstrumentTestContext(packageName) {

    val out: ByteArrayOutputStream    = new ByteArrayOutputStream()
    val logOut: ByteArrayOutputStream = new ByteArrayOutputStream()
    val context =
      Context
        .newBuilder(LanguageInfo.ID)
        .allowExperimentalOptions(true)
        .allowAllAccess(true)
        .option(RuntimeOptions.PROJECT_ROOT, pkg.root.getAbsolutePath)
        .option(
          RuntimeOptions.LOG_LEVEL,
          java.util.logging.Level.WARNING.getName
        )
        .option(RuntimeOptions.INTERPRETER_SEQUENTIAL_COMMAND_EXECUTION, "true")
        .option(RuntimeOptions.ENABLE_PROJECT_SUGGESTIONS, "false")
        .option(RuntimeOptions.ENABLE_GLOBAL_SUGGESTIONS, "false")
        .option(RuntimeOptions.ENABLE_EXECUTION_TIMER, "false")
        .option(RuntimeOptions.STRICT_ERRORS, "false")
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

    lazy val languageContext = executionContext.context
      .getBindings(LanguageInfo.ID)
      .invokeMember(MethodNames.TopScope.LEAK_CONTEXT)
      .asHostObject[EnsoContext]

    def writeMain(contents: String): File =
      Files.write(pkg.mainFile.toPath, contents.getBytes).toFile

    def writeFile(file: File, contents: String): File =
      Files.write(file.toPath, contents.getBytes).toFile

    def writeInSrcDir(moduleName: String, contents: String): File = {
      val file = new File(pkg.sourceDir, s"$moduleName.enso")
      Files.write(file.toPath, contents.getBytes).toFile
    }

    def send(msg: Api.Request): Unit = runtimeServerEmulator.sendToRuntime(msg)

    def consumeOut: List[String] = {
      val result = out.toString
      out.reset()
      result.linesIterator.toList
    }

    def executionComplete(contextId: UUID): Api.Response =
      Api.Response(Api.ExecutionComplete(contextId))
  }

  override protected def beforeEach(): Unit = {
    context = new TestContext("Test")
    context.init()
    val Some(Api.Response(_, Api.InitializedNotification())) = context.receive
  }

  override protected def afterEach(): Unit = {
    if (context != null) {
      context.close()
      context.out.reset()
      context = null
    }
  }

  it should "send expression updates" in {
    val contextId  = UUID.randomUUID()
    val requestId  = UUID.randomUUID()
    val moduleName = "Enso_Test.Test.Main"

    val metadata = new Metadata
    val id_x     = metadata.addItem(46, 3, "aa")

    val code =
      """from Standard.Base import all
        |
        |main =
        |    x = foo
        |    x
        |
        |foo : Text & Integer
        |foo = (42 : Text & Integer)
        |
        |Text.from that:Integer = that.to_text
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
      Api.Request(requestId, Api.OpenFileRequest(mainFile, contents))
    )
    context.receive shouldEqual Some(
      Api.Response(Some(requestId), Api.OpenFileResponse)
    )

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
      Api.Response(requestId, Api.PushContextResponse(contextId)),
      TestMessages.updateMultiType(
        contextId,
        id_x,
        Vector(ConstantsGen.TEXT, ConstantsGen.INTEGER),
        methodCall =
          Some(Api.MethodCall(Api.MethodPointer(moduleName, moduleName, "foo")))
      ),
      context.executionComplete(contextId)
    )
  }

}
