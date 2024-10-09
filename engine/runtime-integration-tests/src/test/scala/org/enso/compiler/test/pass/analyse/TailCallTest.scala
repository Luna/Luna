package org.enso.compiler.test.pass.analyse

import org.enso.compiler.Passes
import org.enso.compiler.context.{FreshNameSupply, InlineContext, ModuleContext}
import org.enso.compiler.core.Implicits.AsMetadata
import org.enso.compiler.core.ir.{
  Expression,
  Function,
  Module,
  Pattern,
  Warning
}
import org.enso.compiler.core.ir.module.scope.definition
import org.enso.compiler.core.ir.expression.Application
import org.enso.compiler.core.ir.expression.Case
import org.enso.compiler.pass.PassConfiguration._
import org.enso.compiler.pass.analyse.TailCall.TailPosition
import org.enso.compiler.pass.analyse.{AliasAnalysis, TailCall}
import org.enso.compiler.pass.{
  MiniPassTraverser,
  PassConfiguration,
  PassGroup,
  PassManager
}
import org.enso.compiler.test.CompilerTest
import org.enso.compiler.context.LocalScope

class TailCallTest extends CompilerTest {

  // === Test Setup ===========================================================

  def mkModuleContext: ModuleContext =
    buildModuleContext(
      freshNameSupply = Some(new FreshNameSupply)
    )

  def mkTailContext: InlineContext =
    buildInlineContext(
      localScope       = Some(LocalScope.createEmpty),
      isInTailPosition = Some(true),
      freshNameSupply  = Some(new FreshNameSupply)
    )

  def mkNoTailContext: InlineContext =
    buildInlineContext(
      localScope       = Some(LocalScope.createEmpty),
      isInTailPosition = Some(false),
      freshNameSupply  = Some(new FreshNameSupply)
    )

  val passes = new Passes(defaultConfig)

  val precursorPasses: PassGroup = passes.getPrecursors(TailCall).get

  val passConfiguration: PassConfiguration = PassConfiguration(
    AliasAnalysis -->> AliasAnalysis.Configuration()
  )

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
    def analyse(implicit context: ModuleContext) = {
      TailCallMegaPass.runModule(ir, context)
    }

    def analyseMini(implicit context: ModuleContext) = {
      val miniPass =
        TailCall.createForModuleCompilation(context)
      MiniPassTraverser.compileModuleWithMiniPass(ir, miniPass)
    }
  }

  /** Adds an extension method to preprocess source code as an Enso expression.
    *
    * @param ir the ir to analyse
    */
  implicit class AnalyseExpresion(ir: Expression) {

    /** Performs tail call analysis on [[ir]].
      *
      * @param context the inline context in which analysis takes place
      * @return [[ir]], with tail call analysis metadata attached
      */
    def analyse(implicit context: InlineContext): Expression = {
      TailCallMegaPass.runExpression(ir, context)
    }

    def analyseMini(implicit context: InlineContext) = {
      val miniPass =
        TailCall.createForInlineCompilation(context)
      MiniPassTraverser.compileInlineWithMiniPass(ir, miniPass)
    }
  }

  private def analyseWithMegaPass(
    code: String
  ): Module = {
    implicit val ctx: ModuleContext = mkModuleContext
    code.preprocessModule.analyse
  }

  private def analyseWithMiniPass(
    code: String
  ): Module = {
    implicit val ctx: ModuleContext = mkModuleContext
    code.preprocessModule.analyseMini
  }

  private def analyseInlineWithMegaPass(
    code: String
  ): Expression = {
    implicit val ctx: InlineContext = mkTailContext
    code.preprocessExpression.get.analyse
  }

  private def analyseInlineWithMiniPass(
    code: String
  ): Expression = {
    implicit val ctx: InlineContext = mkTailContext
    code.preprocessExpression.get.analyseMini
  }

  // === The Tests ============================================================

  "Tail call analysis on modules" should {
    val code =
      """
        |Foo.bar = a -> b -> c ->
        |    d = a + b
        |
        |    case c of
        |      Baz a b -> a * b * d
        |      _ -> d
        |
        |type MyAtom a b c
        |
        |Foo.from (that : Bar) = undefined
        |""".stripMargin

    "mark methods as tail" in {
      val megaIr = analyseWithMegaPass(code)
      megaIr.bindings.head.getMetadata(TailCallMegaPass) shouldEqual Some(
        TailPosition.Tail
      )
      val miniIr = analyseWithMiniPass(code)
      miniIr.bindings.head.getMetadata(TailCall) shouldEqual Some(
        TailPosition.Tail
      )
    }

    "mark atoms as tail" in {
      val megaIr = analyseWithMegaPass(code)
      val miniIr = analyseWithMiniPass(code)
      megaIr.bindings(1).getMetadata(TailCallMegaPass) shouldEqual Some(
        TailPosition.Tail
      )
      miniIr.bindings(1).getMetadata(TailCall) shouldEqual Some(
        TailPosition.Tail
      )
    }

    "mark conversions as tail" in {
      val megaIr = analyseWithMegaPass(code)
      val miniIr = analyseWithMiniPass(code)
      megaIr.bindings(2).getMetadata(TailCallMegaPass) shouldEqual Some(
        TailPosition.Tail
      )
      miniIr.bindings(2).getMetadata(TailCall) shouldEqual Some(
        TailPosition.Tail
      )
    }
  }

  "Tail call analysis on expressions" should {
    val code =
      """
        |x -> y -> z -> x y z
        |""".stripMargin

    "mark the expression as tail if the context requires it" in {
      implicit val ctx: InlineContext = mkTailContext
      val ir                          = code.preprocessExpression.get.analyse

      ir.getMetadata(TailCallMegaPass) shouldEqual Some(TailPosition.Tail)
    }

    "not mark the expression as tail if the context doesn't require it" in {
      implicit val ctx: InlineContext = mkNoTailContext
      val ir                          = code.preprocessExpression.get.analyse

      ir.getMetadata(TailCallMegaPass) shouldEqual Some(TailPosition.NotTail)
    }

    "mark the value of a tail assignment as non-tail" in {
      implicit val ctx: InlineContext = mkTailContext
      val binding =
        """
          |foo = a b
          |""".stripMargin.preprocessExpression.get.analyse
          .asInstanceOf[Expression.Binding]
      binding.getMetadata(TailCallMegaPass) shouldEqual Some(TailPosition.Tail)
      binding.expression.getMetadata(TailCallMegaPass) shouldEqual Some(
        TailPosition.NotTail
      )
    }

    "mark the value of a tail assignment as non-tail (mini pass)" in {
      implicit val ctx: InlineContext = mkTailContext
      val binding =
        """
          |foo = a b
          |""".stripMargin.preprocessExpression.get.analyseMini
          .asInstanceOf[Expression.Binding]
      binding.getMetadata(TailCallMegaPass) shouldEqual Some(TailPosition.Tail)
      binding.expression.getMetadata(TailCallMegaPass) shouldEqual Some(
        TailPosition.NotTail
      )

    }
  }

  "Tail call analysis on functions" should {
    val code =
      """
        |a -> b -> c ->
        |    d = @Tail_Call (a + b)
        |    e = a * c
        |    @Tail_Call (d + e)
        |""".stripMargin
    val megaIr = analyseInlineWithMegaPass(code).asInstanceOf[Function.Lambda]
    val miniIr = analyseInlineWithMiniPass(code).asInstanceOf[Function.Lambda]

    val fnBodyMega = megaIr.body.asInstanceOf[Expression.Block]
    val fnBodyMini = miniIr.body.asInstanceOf[Expression.Block]

    "mark the last expression of the function as tail" in {
      fnBodyMega.returnValue.getMetadata(TailCallMegaPass) shouldEqual Some(
        TailPosition.Tail
      )
      fnBodyMini.returnValue.getMetadata(TailCall) shouldEqual Some(
        TailPosition.Tail
      )
    }

    "mark the other expressions in the function as not tail" in {
      fnBodyMega.expressions.foreach(expr =>
        expr.getMetadata(TailCallMegaPass) shouldEqual Some(
          TailPosition.NotTail
        )
      )
      fnBodyMini.expressions.foreach(expr =>
        expr.getMetadata(TailCall) shouldEqual Some(
          TailPosition.NotTail
        )
      )
    }

    "warn about misplaced @TailCall annotations" in {
      fnBodyMega
        .expressions(0)
        .asInstanceOf[Expression.Binding]
        .expression
        .diagnosticsList
        .count(_.isInstanceOf[Warning.WrongTco]) shouldEqual 1

      fnBodyMega.returnValue.diagnosticsList
        .count(_.isInstanceOf[Warning.WrongTco]) shouldEqual 0
    }

    "warn about misplaced @TailCall annotations (mini)" in {
      fnBodyMini
        .expressions(0)
        .asInstanceOf[Expression.Binding]
        .expression
        .diagnosticsList
        .count(_.isInstanceOf[Warning.WrongTco]) shouldEqual 1

      fnBodyMini.returnValue.diagnosticsList
        .count(_.isInstanceOf[Warning.WrongTco]) shouldEqual 0
    }
  }

  "Tail call analysis on local functions" should {
    implicit val ctx: ModuleContext = mkModuleContext

    val ir =
      """
        |adder_two =
        |    if 0 == 0 then 0 else
        |        @Tail_Call adder_two
        |""".stripMargin.preprocessModule.analyse

    val fnBody = ir.bindings.head
      .asInstanceOf[definition.Method]
      .body
      .asInstanceOf[Function.Lambda]
      .body

    "handle application involving local functions" in {
      fnBody
        .asInstanceOf[Expression.Block]
        .returnValue
        .asInstanceOf[Application.Prefix]
        .arguments(2)
        .value
        .asInstanceOf[Expression.Block]
        .returnValue
        .asInstanceOf[Application.Prefix]
        .function
        .diagnosticsList
        .count(_.isInstanceOf[Warning.WrongTco]) shouldEqual 0
    }

  }

  "Tail call analysis on case expressions" should {
    "not mark any portion of the branch functions as tail by default" in {
      implicit val ctx: ModuleContext = mkModuleContext

      val ir =
        """
          |Foo.bar = a ->
          |    x = case a of
          |        Lambda fn arg -> fn arg
          |
          |    x
          |""".stripMargin.preprocessModule.analyse

      val caseExpr = ir.bindings.head
        .asInstanceOf[definition.Method]
        .body
        .asInstanceOf[Function.Lambda]
        .body
        .asInstanceOf[Expression.Block]
        .expressions
        .head
        .asInstanceOf[Expression.Binding]
        .expression
        .asInstanceOf[Expression.Block]
        .returnValue
        .asInstanceOf[Case.Expr]

      caseExpr.getMetadata(TailCallMegaPass) shouldEqual Some(
        TailPosition.NotTail
      )
      caseExpr.branches.foreach(branch => {
        val branchExpression =
          branch.expression.asInstanceOf[Application.Prefix]

        branchExpression.getMetadata(TailCallMegaPass) shouldEqual Some(
          TailPosition.NotTail
        )
      })
    }

    "only mark the branches as tail if the expression is in tail position" in {
      implicit val ctx: ModuleContext = mkModuleContext

      val ir =
        """
          |Foo.bar = a ->
          |    case a of
          |      Lambda fn arg -> fn arg
          |""".stripMargin.preprocessModule.analyse

      val caseExpr = ir.bindings.head
        .asInstanceOf[definition.Method]
        .body
        .asInstanceOf[Function.Lambda]
        .body
        .asInstanceOf[Expression.Block]
        .returnValue
        .asInstanceOf[Expression.Block]
        .returnValue
        .asInstanceOf[Case.Expr]

      caseExpr.getMetadata(TailCallMegaPass) shouldEqual Some(
        TailPosition.Tail
      )
      caseExpr.branches.foreach(branch => {
        val branchExpression =
          branch.expression.asInstanceOf[Application.Prefix]

        branchExpression.getMetadata(TailCallMegaPass) shouldEqual Some(
          TailPosition.Tail
        )
      })
    }

    "mark patters and pattern elements as not tail" in {
      implicit val ctx: InlineContext = mkTailContext

      val ir =
        """
          |case x of
          |    Cons a b -> a + b
          |""".stripMargin.preprocessExpression.get.analyse
          .asInstanceOf[Expression.Block]
          .returnValue
          .asInstanceOf[Case.Expr]

      val caseBranch         = ir.branches.head
      val pattern            = caseBranch.pattern.asInstanceOf[Pattern.Constructor]
      val patternConstructor = pattern.constructor

      pattern.getMetadata(TailCallMegaPass) shouldEqual Some(
        TailPosition.NotTail
      )
      patternConstructor.getMetadata(TailCallMegaPass) shouldEqual Some(
        TailPosition.NotTail
      )
      pattern.fields.foreach(f => {
        f.getMetadata(TailCallMegaPass) shouldEqual Some(TailPosition.NotTail)

        f.asInstanceOf[Pattern.Name]
          .name
          .getMetadata(TailCallMegaPass) shouldEqual Some(TailPosition.NotTail)
      })
    }
  }

  "Tail call analysis on function calls" should {
    implicit val ctx: ModuleContext = mkModuleContext

    val tailCall =
      """
        |Foo.bar =
        |   IO.println "AAAAA"
        |""".stripMargin.preprocessModule.analyse.bindings.head
        .asInstanceOf[definition.Method]
    val tailCallBody = tailCall.body
      .asInstanceOf[Function.Lambda]
      .body
      .asInstanceOf[Expression.Block]

    val nonTailCall =
      """
        |Foo.bar =
        |    a = b c d
        |    a
        |""".stripMargin.preprocessModule.analyse.bindings.head
        .asInstanceOf[definition.Method]
    val nonTailCallBody = nonTailCall.body
      .asInstanceOf[Function.Lambda]
      .body
      .asInstanceOf[Expression.Block]

    "mark the arguments as tail" in {
      nonTailCallBody.expressions.head
        .asInstanceOf[Expression.Binding]
        .expression
        .asInstanceOf[Application.Prefix]
        .arguments
        .foreach(arg =>
          arg.getMetadata(TailCall) shouldEqual Some(
            TailPosition.Tail
          )
        )

      tailCallBody.returnValue
        .asInstanceOf[Application.Prefix]
        .arguments
        .foreach(arg =>
          arg.getMetadata(TailCallMegaPass) shouldEqual Some(
            TailPosition.Tail
          )
        )
    }

    "mark the function call as tail if it is in a tail position" in {
      tailCallBody.returnValue.getMetadata(TailCallMegaPass) shouldEqual Some(
        TailPosition.Tail
      )
    }

    "mark the function call as not tail if it is in a tail position" in {
      nonTailCallBody.expressions.head
        .asInstanceOf[Expression.Binding]
        .expression
        .getMetadata(TailCallMegaPass) shouldEqual Some(TailPosition.NotTail)
    }
  }

  "Tail call analysis on blocks" should {
    implicit val ctx: ModuleContext = mkModuleContext

    val ir =
      """
        |Foo.bar = a -> b -> c ->
        |    d = a + b
        |    mul = a -> b -> a * b
        |    mul c d
        |""".stripMargin.preprocessModule.analyse.bindings.head
        .asInstanceOf[definition.Method]

    val block = ir.body
      .asInstanceOf[Function.Lambda]
      .body
      .asInstanceOf[Expression.Block]

    "mark the bodies of bound functions as tail properly" in {
      block
        .expressions(1)
        .asInstanceOf[Expression.Binding]
        .expression
        .asInstanceOf[Function.Lambda]
        .body
        .getMetadata(TailCallMegaPass) shouldEqual Some(TailPosition.Tail)
    }

    "mark the block expressions as not tail" in {
      block.expressions.foreach(expr =>
        expr.getMetadata(TailCallMegaPass) shouldEqual Some(
          TailPosition.NotTail
        )
      )
    }

    "mark the final expression of the block as tail" in {
      block.returnValue.getMetadata(TailCallMegaPass) shouldEqual Some(
        TailPosition.Tail
      )
    }

    "mark the block as tail if it is in a tail position" in {
      block.getMetadata(TailCallMegaPass) shouldEqual Some(TailPosition.Tail)
    }
  }
}
