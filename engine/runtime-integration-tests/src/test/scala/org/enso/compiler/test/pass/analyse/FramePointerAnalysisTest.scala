package org.enso.compiler.test.pass.analyse

import org.enso.compiler.Passes
import org.enso.compiler.context.{FramePointer, FreshNameSupply, ModuleContext}
import org.enso.compiler.core.IR
import org.enso.compiler.core.ir.Expression
import org.enso.compiler.core.Implicits.AsMetadata
import org.enso.compiler.core.ir.Module
import org.enso.compiler.pass.analyse.alias.{Graph, Info}
import org.enso.compiler.pass.{PassConfiguration, PassGroup, PassManager}
import org.enso.compiler.pass.analyse.{AliasAnalysis, FramePointerAnalysis}
import org.enso.compiler.test.CompilerTest

class FramePointerAnalysisTest extends CompilerTest {

  // === Test Setup ===========================================================

  def mkModuleContext: ModuleContext =
    buildModuleContext(
      freshNameSupply = Some(new FreshNameSupply)
    )

  val passes = new Passes(defaultConfig)

  val precursorPasses: PassGroup =
    passes.getPrecursors(FramePointerAnalysis).get

  val passConfiguration: PassConfiguration = PassConfiguration()

  implicit val passManager: PassManager =
    new PassManager(List(precursorPasses), passConfiguration)

  /** Adds an extension method to analyse an Enso module.
    *
    * @param ir the ir to analyse
    */
  implicit class AnalyseModule(ir: Module) {

    /** Performs tail call analysis on [[ir]].
      *
      * @param context the module context in which analysis takes place
      * @return [[ir]], with tail call analysis metadata attached
      */
    def analyse(implicit context: ModuleContext): Module = {
      FramePointerAnalysis.runModule(ir, context)
    }
  }

  // === The Tests ============================================================
  "Frame pointer analysis" should {
    "attach frame pointers to local variables" in {
      implicit val ctx: ModuleContext = mkModuleContext
      val ir =
        """
          |main =
          |    a = 1
          |    b = 2
          |    42
          |""".stripMargin.preprocessModule.analyse
      val allOcc = collectAllOccurences(ir)
      allOcc.size shouldBe 2
      withClue("Occurences are attached to Expression.Binding") {
        val firstOcc = allOcc.head
        firstOcc._1
          .asInstanceOf[Expression.Binding]
          .name
          .name shouldEqual "a"
        val secondOcc = allOcc.last
        secondOcc._1
          .asInstanceOf[Expression.Binding]
          .name
          .name shouldEqual "b"
      }
      withClue("Expression.Binding must have FramePointer associated") {
        allOcc.head._1
          .unsafeGetMetadata(FramePointerAnalysis, "should exist")
          .framePointer shouldEqual new FramePointer(0, 1)
        allOcc.last._1
          .unsafeGetMetadata(FramePointerAnalysis, "should exist")
          .framePointer shouldEqual new FramePointer(0, 2)
      }
    }

    "attach frame pointers to parameters" in {
      implicit val ctx: ModuleContext = mkModuleContext
      val ir =
        """
          |main x y = x + y
          |""".stripMargin.preprocessModule.analyse
      val framePointers = collectAllFramePointers(ir)
      framePointers.size shouldBe 4
      framePointers(0)._2.framePointer shouldEqual new FramePointer(0, 1)
      framePointers(1)._2.framePointer shouldEqual new FramePointer(0, 2)
    }

    "attach frame pointers inside nested scope" in {
      implicit val ctx: ModuleContext = mkModuleContext
      val ir =
        """
          |main =
          |    nested x y = x + y
          |    nested 1 2
          |""".stripMargin.preprocessModule.analyse
      val mainScope = ir.bindings.head
        .unsafeGetMetadata(AliasAnalysis, "should exist")
        .asInstanceOf[Info.Scope.Root]

      withClue(
        "Both definition and usage of `x` should be associated with the same frame pointer"
      ) {
        mainScope.graph.symbolToIds[Graph.Occurrence]("x").foreach { xId =>
          val xIr = findAssociatedIr(xId, ir)
          expectFramePointer(xIr, new FramePointer(0, 1))
        }
      }
      withClue(
        "Both definition and usage of `y` should be associated with the same frame pointer"
      ) {
        mainScope.graph.symbolToIds[Graph.Occurrence]("y").foreach { yId =>
          val yIr = findAssociatedIr(yId, ir)
          expectFramePointer(yIr, new FramePointer(0, 2))
        }
      }

      mainScope.graph.symbolToIds[Graph.Occurrence]("nested").foreach {
        nestedId =>
          val nestedIr = findAssociatedIr(nestedId, ir)
          expectFramePointer(nestedIr, new FramePointer(0, 1))
      }
    }

    "attach frame pointer in nested scope that uses parent scope" in {
      implicit val ctx: ModuleContext = mkModuleContext
      val ir =
        """
          |main =
          |    x = 1
          |    nested =
          |        x + 1
          |    nested
          |""".stripMargin.preprocessModule.analyse
      val mainScope = ir.bindings.head
        .unsafeGetMetadata(AliasAnalysis, "should exist")
        .asInstanceOf[Info.Scope.Root]
      val xDefIr = findAssociatedIr(
        mainScope.graph.symbolToIds[Graph.Occurrence.Def]("x").head,
        ir
      )
      expectFramePointer(xDefIr, new FramePointer(0, 1))

      val nestedDefIr = findAssociatedIr(
        mainScope.graph.symbolToIds[Graph.Occurrence.Def]("nested").head,
        ir
      )
      expectFramePointer(nestedDefIr, new FramePointer(0, 2))

      val xUseIr = findAssociatedIr(
        mainScope.graph.symbolToIds[Graph.Occurrence.Use]("x").head,
        ir
      )
      expectFramePointer(xUseIr, new FramePointer(1, 1))

      val nestedUseIr = findAssociatedIr(
        mainScope.graph.symbolToIds[Graph.Occurrence.Use]("nested").head,
        ir
      )
      expectFramePointer(nestedUseIr, new FramePointer(0, 2))
    }
  }

  /** Asserts that the given `ir` has the given `framePointer` attached as metadata.
    */
  private def expectFramePointer(
    ir: IR,
    framePointer: FramePointer
  ): Unit = {
    withClue("FramePointerAnalysis metadata should be attached to the IR") {
      ir.passData().get(FramePointerAnalysis) shouldBe defined
    }
    ir
      .unsafeGetMetadata(FramePointerAnalysis, "should exist")
      .framePointer shouldEqual framePointer
  }

  private def findAssociatedIr(
    id: Graph.Id,
    moduleIr: IR
  ): IR = {
    val irs = moduleIr.preorder().collect { childIr =>
      childIr.getMetadata(AliasAnalysis) match {
        case Some(Info.Occurrence(_, occId)) if occId == id =>
          childIr
      }
    }
    withClue(
      "There should be just one IR element that has a particular Graph.ID"
    ) {
      irs.size shouldBe 1
    }
    irs.head
  }

  private def collectAllOccurences(
    ir: IR
  ): List[(IR, Info.Occurrence)] = {
    ir.preorder().flatMap { childIr =>
      childIr.getMetadata(AliasAnalysis) match {
        case Some(occMeta: Info.Occurrence) =>
          Some((childIr, occMeta))
        case _ => None
      }
    }
  }

  private def collectAllFramePointers(
    ir: IR
  ): List[(IR, FramePointerAnalysis.Metadata)] = {
    ir.preorder().flatMap { childIr =>
      childIr.getMetadata(FramePointerAnalysis) match {
        case Some(framePointerMeta: FramePointerAnalysis.Metadata) =>
          Some((childIr, framePointerMeta))
        case _ => None
      }
    }
  }
}
