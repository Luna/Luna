package org.enso.compiler.pass.lint

import org.enso.compiler.context.{InlineContext, ModuleContext}
import org.enso.compiler.core.Implicits.AsDiagnostics
import org.enso.compiler.core.{CompilerError, IR}
import org.enso.compiler.core.ir.{Expression, Name, Pattern}
import org.enso.compiler.core.ir.expression.{errors, warnings, Case}
import org.enso.compiler.pass.analyse.{
  AliasAnalysis,
  DataflowAnalysis,
  DemandAnalysis,
  TailCall
}
import org.enso.compiler.pass.desugar.{GenerateMethodBodies, NestedPatternMatch}
import org.enso.compiler.pass.resolve.IgnoredBindings
import org.enso.compiler.pass.{
  IRPass,
  IRProcessingPass,
  MiniIRPass,
  MiniPassFactory
}

import scala.collection.mutable

/** This pass detects and renames shadowed pattern fields.
  *
  * This is necessary both in order to create a warning, but also to ensure that
  * alias analysis doesn't get confused.
  *
  * This pass requires no configuration.
  *
  * This pass requires the context to provide:
  *
  * - Nothing
  */
case object ShadowedPatternFields extends MiniPassFactory {
  override type Metadata = IRPass.Metadata.Empty

  override def precursorPasses(): Seq[IRProcessingPass] = List(
    GenerateMethodBodies
  )

  override def invalidatedPasses(): Seq[IRProcessingPass] = List(
    AliasAnalysis,
    DataflowAnalysis,
    DemandAnalysis,
    IgnoredBindings,
    NestedPatternMatch,
    TailCall.INSTANCE
  )

  override def createForModuleCompilation(
    moduleContext: ModuleContext
  ): MiniIRPass = {
    new ShadowedPatternFields.Mini()
  }

  override def createForInlineCompilation(
    inlineContext: InlineContext
  ): MiniIRPass = {
    new ShadowedPatternFields.Mini()
  }

  private class Mini extends MiniIRPass {
    override def transformExpression(
      expr: Expression
    ): Expression = {
      expr match {
        case branch: Case.Branch =>
          lintCaseBranch(branch)
        case caseExpr: Case.Expr =>
          val newBranches = caseExpr.branches.map(lintCaseBranch)
          caseExpr.copy(
            branches = newBranches
          )
        case _ => expr
      }
    }

    /** Lints for shadowed pattern variables in a case branch.
      *
      * @param branch the case branch to lint
      * @return `branch`, with warnings for any shadowed pattern variables
      */
    def lintCaseBranch(
      branch: Case.Branch
    ): Case.Branch = {
      branch.copy(
        pattern = lintPattern(branch.pattern)
      )
    }

    /** Lints a pattern for shadowed pattern variables.
      *
      * A later pattern variable shadows an earlier pattern variable with the same
      * name.
      *
      * @param pattern the pattern to lint
      * @return `pattern`, with a warning applied to any shadowed pattern
      *         variables
      */
    private def lintPattern(pattern: Pattern): Pattern = {
      val seenNames: mutable.Set[String]    = mutable.Set()
      val lastSeen: mutable.Map[String, IR] = mutable.Map()

      def go(pattern: Pattern, seenNames: mutable.Set[String]): Pattern = {
        pattern match {
          case named @ Pattern.Name(name, location, _) =>
            if (seenNames.contains(name.name)) {
              val warning = warnings.Shadowed
                .PatternBinding(name.name, lastSeen(name.name), location)

              lastSeen(name.name) = named
              named
                .copy(
                  name = Name.Blank(name.identifiedLocation())
                )
                .addDiagnostic(warning)
            } else if (!name.isInstanceOf[Name.Blank]) {
              lastSeen(name.name) = named
              seenNames += name.name
              named
            } else {
              named
            }
          case cons @ Pattern.Constructor(_, fields, _, _) =>
            val newFields = fields.reverse.map(go(_, seenNames)).reverse

            cons.copy(
              fields = newFields
            )
          case literal: Pattern.Literal =>
            literal
          case typed @ Pattern.Type(name, _, location, _) =>
            if (seenNames.contains(name.name)) {
              val warning = warnings.Shadowed
                .PatternBinding(name.name, lastSeen(name.name), location)

              lastSeen(name.name) = typed
              typed
                .copy(
                  name = Name.Blank(name.identifiedLocation())
                )
                .addDiagnostic(warning)
            } else if (!name.isInstanceOf[Name.Blank]) {
              lastSeen(name.name) = typed
              seenNames += name.name
              typed
            } else {
              typed
            }
          case _: Pattern.Documentation =>
            throw new CompilerError(
              "Branch documentation should be desugared at an earlier stage."
            )
          case err: errors.Pattern => err
        }
      }

      go(pattern, seenNames)
    }
  }
}
