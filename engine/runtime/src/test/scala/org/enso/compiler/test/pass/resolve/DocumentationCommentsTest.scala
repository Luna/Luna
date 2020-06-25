package org.enso.compiler.test.pass.resolve

import org.enso.compiler.Passes
import org.enso.compiler.context.{FreshNameSupply, InlineContext, ModuleContext}
import org.enso.compiler.core.IR
import org.enso.compiler.pass.analyse.{
  AliasAnalysis,
  CachePreferenceAnalysis,
  DataflowAnalysis,
  DemandAnalysis,
  TailCall
}
import org.enso.compiler.pass.desugar.{
  ComplexType,
  FunctionBinding,
  GenerateMethodBodies,
  LambdaShorthandToLambda,
  NestedPatternMatch,
  OperatorToFunction,
  SectionsToBinOp
}
import org.enso.compiler.pass.lint.{ShadowedPatternFields, UnusedBindings}
import org.enso.compiler.pass.optimise.{
  ApplicationSaturation,
  LambdaConsolidate,
  UnreachableMatchBranches
}
import org.enso.compiler.pass.resolve.{
  DocumentationComments,
  IgnoredBindings,
  OverloadsResolution,
  SuspendedArguments,
  TypeFunctions,
  TypeSignatures
}
import org.enso.compiler.pass.{IRPass, PassConfiguration, PassManager}
import org.enso.compiler.test.CompilerTest
import org.scalatest.Inside

class DocumentationCommentsTest extends CompilerTest with Inside {

  // === Test Setup ===========================================================

  val precursorPasses: List[IRPass] = List()
  val passConfig: PassConfiguration = PassConfiguration()

  implicit val passManager: PassManager =
    new PassManager(precursorPasses, passConfig)

  /** Resolves documentation comments in a module.
    *
    * @param ir the module
    */
  implicit class ResolveModule(ir: IR.Module) {

    /** Resolves documentation comments for [[ir]].
      *
      * @param moduleContext the context in which to resolve
      * @return [[ir]], with documentation resolved
      */
    def resolve(implicit moduleContext: ModuleContext): IR.Module = {
      DocumentationComments.runModule(ir, moduleContext)
    }
  }

  /** Resolves documentation comments in an expression.
    *
    * @param ir the expression
    */
  implicit class ResolveExpression(ir: IR.Expression) {

    /** Resolves documentation comments for [[ir]].
      *
      * @param inlineContext the context in which to resolve
      * @return [[ir]], with documentation resolved
      */
    def resolve(implicit inlineContext: InlineContext): IR.Expression = {
      DocumentationComments.runExpression(ir, inlineContext)
    }
  }

  /** Creates a defaulted module context.
    *
    * @return a defaulted module context
    */
  def mkModuleContext: ModuleContext = {
    ModuleContext()
  }

  /** Creates a defaulted inline context.
    *
    * @return a defaulted inline context
    */
  def mkInlineContext: InlineContext = {
    InlineContext()
  }

  /**
    * Gets documentation metadata from a node.
    * Throws an exception if missing.
    *
    * @param ir the ir to get the doc from.
    * @return the doc assigned to `ir`.
    */
  def getDoc(ir: IR): String = {
    val meta = ir.getMetadata(DocumentationComments)
    meta shouldBe defined
    meta.get.documentation
  }

  // === The Tests ============================================================

  "Documentation comments in the top scope" should {
    "be associated with atoms and methods" in {
      implicit val moduleContext: ModuleContext = mkModuleContext
      val ir =
        """
          |## This is doc for My_Atom
          |type My_Atom a b c
          |
          |## This is doc for my_method
          |MyAtom.my_method x = x + this
          |
          |""".stripMargin.preprocessModule.resolve

      ir.bindings.length shouldEqual 2
      ir.bindings(0) shouldBe an[IR.Module.Scope.Definition.Atom]
      ir.bindings(1) shouldBe an[IR.Module.Scope.Definition.Method]

      getDoc(ir.bindings(0)) shouldEqual " This is doc for My_Atom"
      getDoc(ir.bindings(1)) shouldEqual " This is doc for my_method"
    }
  }

  "Documentation comments in blocks" should {
    "be associated with the documented expression in expression flow" in {
      implicit val inlineContext: InlineContext = mkInlineContext
      val ir =
        """
          |x -> y ->
          |    ## Do thing
          |    x + y
          |    ## Do another thing
          |    z = x * y
          |""".stripMargin.preprocessExpression.get.resolve
      val body = ir
        .asInstanceOf[IR.Function.Lambda]
        .body
        .asInstanceOf[IR.Function.Lambda]
        .body
        .asInstanceOf[IR.Expression.Block]

      body.expressions.length shouldEqual 1
      getDoc(body.expressions(0)) shouldEqual " Do thing"
      getDoc(body.returnValue) shouldEqual " Do another thing"
    }

    "be associated with the documented expression in module flow" in {
      implicit val moduleContext: ModuleContext = mkModuleContext
      val ir =
        """
          |method x =
          |    ## Do thing
          |    x + y
          |    ## Do another thing
          |    z = x * y
          |""".stripMargin.preprocessModule.resolve
      val body = ir
        .bindings(0)
        .asInstanceOf[IR.Module.Scope.Definition.Method.Binding]
        .body
        .asInstanceOf[IR.Expression.Block]

      body.expressions.length shouldEqual 1
      getDoc(body.expressions(0)) shouldEqual " Do thing"
      getDoc(body.returnValue) shouldEqual " Do another thing"
    }
  }

  "Documentation in complex type definitions" should {
    implicit val moduleContext: ModuleContext = mkModuleContext
    "assign docs to all entities" in {
      val ir =
        """
          |## the type Foo
          |type Foo
          |    ## the constructor Bar
          |    type Bar
          |
          |    ## the included Unit
          |    Unit
          |
          |    ## a method
          |    foo x =
          |        ## a statement
          |        IO.println "foo"
          |        ## the return
          |        0
          |""".stripMargin.preprocessModule.resolve
      val tp = ir.bindings(0).asInstanceOf[IR.Module.Scope.Definition.Type]
      getDoc(tp) shouldEqual " the type Foo"
      val t1 = tp.body(0)
      getDoc(t1) shouldEqual " the constructor Bar"
      val t2 = tp.body(1)
      getDoc(t2) shouldEqual " the included Unit"
      val method = tp.body(2).asInstanceOf[IR.Function.Binding]
      getDoc(method) shouldEqual " a method"
      val block = method.body.asInstanceOf[IR.Expression.Block]
      getDoc(block.expressions(0)) shouldEqual " a statement"
      getDoc(block.returnValue) shouldEqual " the return"
    }
  }

  "Documentation" should {
    "be preserved after rewriting" in {
      implicit val passManager: PassManager =
        new Passes(
          Some(
            List(
              DocumentationComments, // defined here
              ComplexType,           // defined after this
              FunctionBinding /*, // not defined after this
              GenerateMethodBodies, // not defined after this
              SectionsToBinOp,
              OperatorToFunction, // Not defined here
              LambdaShorthandToLambda,
              ShadowedPatternFields,
              UnreachableMatchBranches,
              NestedPatternMatch,
              IgnoredBindings,
              TypeFunctions,
              TypeSignatures,
              AliasAnalysis,
              LambdaConsolidate,
              AliasAnalysis,
              SuspendedArguments,
              OverloadsResolution,
              AliasAnalysis,
              DemandAnalysis,
              AliasAnalysis,
              ApplicationSaturation,
              TailCall,
              AliasAnalysis,
              DataflowAnalysis,
              CachePreferenceAnalysis,
              UnusedBindings*/
            )
          )
        ).passManager
      implicit val moduleContext: ModuleContext =
        ModuleContext(freshNameSupply = Some(new FreshNameSupply))

      val module =
        """## The foo
          |foo = 42""".stripMargin.preprocessModule
      module.bindings.head.getMetadata(DocumentationComments) shouldBe defined
    }

    "be preserved after rewriting for all entities" in {
      implicit val passManager: PassManager =
        new Passes(
          Some(
            List(
              DocumentationComments, // defined here
              ComplexType
            )
          )
        ).passManager

      implicit val moduleContext: ModuleContext =
        ModuleContext(freshNameSupply = Some(new FreshNameSupply))

      val ir =
        """
          |## the type Foo
          |type Foo
          |    ## the constructor Bar
          |    type Bar
          |
          |    ## a method
          |    foo x =
          |        ## a statement
          |        IO.println "foo"
          |        ## the return
          |        0
          |""".stripMargin.preprocessModule

      val t1 = ir.bindings(0)
      getDoc(t1) shouldEqual " the constructor Bar"
      inside(ir.bindings(1)) {
        case method: IR.Module.Scope.Definition.Method.Binding =>
          getDoc(method) shouldEqual " a method"
          inside(method.body) {
            case block: IR.Expression.Block =>
              getDoc(block.expressions(0)) shouldEqual " a statement"
              getDoc(block.returnValue) shouldEqual " the return"
          }
      }
    }
  }
}
