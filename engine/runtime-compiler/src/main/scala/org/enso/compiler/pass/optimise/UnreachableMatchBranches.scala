package org.enso.compiler.pass.optimise

import org.enso.compiler.context.{InlineContext, ModuleContext}
import org.enso.compiler.core.Implicits.AsDiagnostics
import org.enso.compiler.core.ir.{Expression, IdentifiedLocation, Pattern}
import org.enso.compiler.core.ir.expression.{errors, warnings, Case}
import org.enso.compiler.core.CompilerError
import org.enso.compiler.pass.{
  IRPass,
  IRProcessingPass,
  MiniIRPass,
  MiniPassFactory
}
import org.enso.compiler.pass.analyse.{
  AliasAnalysis,
  DataflowAnalysis,
  DemandAnalysis,
  TailCall
}
import org.enso.compiler.pass.desugar._
import org.enso.compiler.pass.resolve.{DocumentationComments, IgnoredBindings}

/** This pass discovers and optimised away unreachable case branches.
  *
  * It removes these unreachable expressions from the IR, and attaches a
  * [[org.enso.compiler.core.ir.Warning]] diagnostic to the case expression itself.
  *
  * Currently, a branch is considered 'unreachable' by this pass if:
  *
  * - It occurs after a catch-all branch.
  *
  * In the future, this pass should be expanded to consider patterns that are
  * entirely subsumed by previous patterns in its definition of uncreachable,
  * but this requires doing sophisticated coverage analysis, and hence should
  * happen as part of the broader refactor of nested patterns desugaring.
  *
  * This pass requires no configuration.
  *
  * This pass requires the context to provide:
  *
  * - Nothing
  */
case object UnreachableMatchBranches extends MiniPassFactory {
  override type Metadata = IRPass.Metadata.Empty

  override lazy val precursorPasses: Seq[IRProcessingPass] = List(
    ComplexType,
    DocumentationComments,
    FunctionBinding,
    GenerateMethodBodies,
    LambdaShorthandToLambda
  )
  override lazy val invalidatedPasses: Seq[IRProcessingPass] = List(
    AliasAnalysis,
    DataflowAnalysis,
    DemandAnalysis,
    IgnoredBindings,
    NestedPatternMatch,
    TailCall.INSTANCE
  )

  override def createForInlineCompilation(
    inlineContext: InlineContext
  ): MiniIRPass = {
    new Mini()
  }

  override def createForModuleCompilation(
    moduleContext: ModuleContext
  ): MiniIRPass = {
    new Mini()
  }

  private class Mini extends MiniIRPass {
    override def transformExpression(
      expr: Expression
    ): Expression = {
      expr match {
        case cse: Case => optimizeCase(cse)
        case _         => expr
      }
    }

    /** Optimizes a case expression by removing unreachable branches.
      *
      * Additionally, it will attach a warning about unreachable branches to the
      * case expression.
      *
      * @param cse the case expression to optimize
      * @return `cse` with unreachable branches removed
      */
    //noinspection DuplicatedCode
    private def optimizeCase(cse: Case): Case = {
      cse match {
        case expr @ Case.Expr(_, branches, _, _, _) =>
          val reachableNonCatchAllBranches = branches.takeWhile(!isCatchAll(_))
          val firstCatchAll                = branches.find(isCatchAll)
          val unreachableBranches =
            branches.dropWhile(!isCatchAll(_)).drop(1)
          val reachableBranches = firstCatchAll
            .flatMap(b => Some(reachableNonCatchAllBranches :+ b))
            .getOrElse(List())
            .toList

          if (unreachableBranches.isEmpty) {
            expr
          } else {
            val unreachableLocation =
              unreachableBranches.foldLeft(None: Option[IdentifiedLocation])(
                (loc, branch) => {
                  loc match {
                    case Some(loc) =>
                      branch.location match {
                        case Some(branchLoc) =>
                          Some(
                            new IdentifiedLocation(
                              loc.start,
                              branchLoc.end,
                              loc.uuid
                            )
                          )
                        case None => Some(loc)
                      }
                    case None => branch.location
                  }
                }
              )

            val diagnostic =
              warnings.Unreachable.Branches(unreachableLocation.orNull)

            expr
              .copy(
                branches = reachableBranches
              )
              .addDiagnostic(diagnostic)
          }
        case _: Case.Branch =>
          throw new CompilerError("Unexpected case branch.")
      }
    }

    /** Determines if a branch is a catch all branch.
      *
      * @param branch the branch to check
      * @return `true` if `branch` is catch-all, otherwise `false`
      */
    private def isCatchAll(branch: Case.Branch): Boolean = {
      branch.pattern match {
        case _: Pattern.Name          => true
        case _: Pattern.Constructor   => false
        case _: Pattern.Literal       => false
        case _: Pattern.Type          => false
        case _: Pattern.Documentation => false
        case _: errors.Pattern        => true
      }
    }
  }
}
