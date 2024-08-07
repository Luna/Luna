package org.enso.compiler.pass.analyse

import org.enso.compiler.context.{
  CompilerContext,
  FramePointer,
  InlineContext,
  LocalScope,
  ModuleContext
}
import org.enso.compiler.core.{CompilerError, IR}
import org.enso.compiler.core.ir.expression.{Application, Case}
import org.enso.compiler.core.ir.{
  CallArgument,
  DefinitionArgument,
  Expression,
  Function,
  Module,
  Name,
  Pattern,
  ProcessingPass
}
import org.enso.compiler.core.ir.module.scope.Definition
import org.enso.compiler.core.ir.module.scope.definition.Method
import org.enso.compiler.pass.IRPass
import org.enso.compiler.pass.IRPass.IRMetadata
import org.enso.compiler.pass.analyse.alias.{Graph, Info}

/** This pass attaches [[FramePointer]] as metadata to all the IR elements that already
  * have [[org.enso.compiler.pass.analyse.alias.Info.Occurrence]] attached.
  * It does not replace the IR elements with errors, it just attaches metadata.
  */
case object FramePointerAnalysis extends IRPass {

  override type Metadata = FramePointerMeta

  override type Config = IRPass.Configuration.Default

  override val precursorPasses: Seq[IRPass] = {
    Seq(AliasAnalysis)
  }

  override val invalidatedPasses: Seq[IRPass] = Seq(this)

  override def runModule(ir: Module, moduleContext: ModuleContext): Module = {
    ir.bindings.foreach(processBinding)
    ir
  }

  private def processBinding(
    ir: Definition
  ): Unit = {
    ir match {
      case m: Method.Explicit =>
        getAliasAnalysisGraph(m) match {
          case Some(graph) =>
            processExpression(m.body, graph)
          case _ => ()
        }
      case m: Method.Conversion =>
        getAliasAnalysisGraph(m) match {
          case Some(graph) =>
            processExpression(m.body, graph)
          case _ => ()
        }
      case t: Definition.Type =>
        getAliasAnalysisGraph(t) match {
          case Some(graph) =>
            processArgumentDefs(t.params, graph)
            t.members.foreach { member =>
              val memberGraph = getAliasRootScope(member) match {
                case Some(memberRootScope) =>
                  memberRootScope.graph
                case _ => graph
              }
              processArgumentDefs(member.arguments, memberGraph)
              member.annotations.foreach { annotation =>
                processExpression(annotation.expression, memberGraph)
              }
            }
          case _ => ()
        }
      case _ => ()
    }
  }

  private def processArgumentDefs(
    args: List[DefinitionArgument],
    graph: Graph
  ): Unit = {
    args.foreach { arg =>
      arg.name match {
        case Name.Self(loc, synthetic, _, _) if loc.isEmpty && synthetic =>
          // synthetic self argument has occurrence attached, but there is no Occurence.Def for it.
          // So we have to handle it specially.
          updateMeta(arg, new FramePointer(0, 1))
        case _ =>
          maybeAttachFramePointer(arg, graph)
      }
    }
  }

  private def processExpression(
    exprIr: Expression,
    graph: Graph
  ): Unit = {
    exprIr match {
      case name: Name => maybeAttachFramePointer(name, graph)
      case block: Expression.Block =>
        block.expressions.foreach { blockExpr =>
          processExpression(blockExpr, graph)
        }
        processExpression(block.returnValue, graph)
      case Function.Lambda(args, body, _, _, _, _) =>
        processArgumentDefs(args, graph)
        processExpression(body, graph)
      case binding @ Expression.Binding(name, expr, _, _, _) =>
        maybeAttachFramePointer(binding, graph)
        maybeAttachFramePointer(name, graph)
        processExpression(expr, graph)
        maybeAttachFramePointer(binding, graph)
      case app: Application => processApplication(app, graph)
      case caseExpr: Case.Expr =>
        processExpression(caseExpr.scrutinee, graph)
        caseExpr.branches.foreach { branch =>
          processCaseBranch(branch)
        }
      case _ => ()
    }
  }

  private def processCaseBranch(
    branch: Case.Branch
  ): Unit = {
    getAliasAnalysisGraph(branch) match {
      case None =>
        throw new CompilerError(
          "An alias analysis graph is expected on " + branch
        )
      case Some(graph) =>
        processExpression(branch.expression, graph)
        processCasePattern(branch.pattern, graph)
    }
  }

  /** @param graph Graph fetched from the corresponding Case.Branch
    */
  private def processCasePattern(
    pattern: Pattern,
    graph: Graph
  ): Unit = {
    pattern match {
      case name: Pattern.Name =>
        processExpression(name.name, graph)
      case lit: Pattern.Literal =>
        processExpression(lit.literal, graph)
      case tp: Pattern.Type =>
        processExpression(tp.name, graph)
        processExpression(tp.tpe, graph)
      case ctor: Pattern.Constructor =>
        processExpression(ctor.constructor, graph)
        ctor.fields.foreach { field =>
          processCasePattern(field, graph)
        }
      case _: Pattern.Documentation => ()
    }
  }

  private def processApplication(
    application: Application,
    graph: Graph
  ): Unit = {
    application match {
      case app @ Application.Prefix(func, arguments, _, _, _, _) =>
        maybeAttachFramePointer(app, graph)
        processExpression(func, graph)
        processCallArguments(arguments, graph)
      case Application.Force(expr, _, _, _) =>
        processExpression(expr, graph)
      case Application.Sequence(items, _, _, _) =>
        items.foreach { item =>
          processExpression(item, graph)
        }
      case Application.Typeset(expr, _, _, _) =>
        expr.foreach(processExpression(_, graph))
      case _ =>
        throw new CompilerError(
          "Unexpected type of Application: " + application
        )
    }
  }

  private def processCallArguments(
    arguments: List[CallArgument],
    graph: Graph
  ): Unit = {
    arguments.foreach {
      case arg @ CallArgument.Specified(name, value, _, _, _) =>
        maybeAttachFramePointer(arg, graph)
        name.foreach(maybeAttachFramePointer(_, graph))
        processExpression(value, graph)
    }
  }

  /** Attaches [[FramePointerMeta]] metadata to the given `ir` if there is an
    * appropriate [[Info.Occurrence]] already attached to it.
    * @param ir IR to attach the frame pointer metadata to.
    * @param graph Alias analysis graph
    * @return Copy of `ir` with attached metadata, or just the `ir` if nothing
    *         was attached.
    */
  private def maybeAttachFramePointer(
    ir: IR,
    graph: Graph
  ): Unit = {
    getAliasAnalysisMeta(ir) match {
      case Some(Info.Occurrence(_, id)) =>
        graph.scopeFor(id) match {
          case Some(scope) =>
            graph.getOccurrence(id) match {
              case Some(use: Graph.Occurrence.Use) =>
                // Use is allowed to read a variable from some parent scope
                graph.defLinkFor(use.id) match {
                  case Some(defLink) =>
                    val defId = defLink.target
                    val defOcc = graph
                      .getOccurrence(defId)
                      .get
                      .asInstanceOf[Graph.Occurrence.Def]
                    val defScope    = graph.scopeFor(defId).get
                    val parentLevel = getScopeDistance(defScope, scope)
                    val frameSlotIdx =
                      getFrameSlotIdxInScope(graph, defScope, defOcc)
                    updateMeta(ir, new FramePointer(parentLevel, frameSlotIdx))
                  case None =>
                    // It is possible that there is no Def for this Use. It can, for example, be
                    // Use for some global symbol. In `IrToTruffle`, an UnresolvedSymbol will be
                    // generated for it.
                    // We will not attach any metadata in this case.
                    ()
                }
              case Some(defn: Graph.Occurrence.Def) =>
                // The definition cannot write to parent's frame slots.
                val parentLevel  = 0
                val frameSlotIdx = getFrameSlotIdxInScope(graph, scope, defn)
                updateMeta(ir, new FramePointer(parentLevel, frameSlotIdx))
              case _ => ()
            }
          case _ => ()
        }
      case _ => ()
    }
  }

  private def updateMeta(
    ir: IR,
    framePointer: FramePointer
  ): Unit = {
    ir.passData().update(this, new FramePointerMeta(framePointer))
  }

  /** Returns the index of the given `defOcc` definition in the given `scope`
    * @param scope This scope must contain the given `defOcc`
    * @param defOcc This occurrence must be in the given `scope`
    */
  private def getFrameSlotIdxInScope(
    graph: Graph,
    scope: Graph.Scope,
    defOcc: Graph.Occurrence.Def
  ): Int = {
    assert(
      graph.scopeFor(defOcc.id).contains(scope),
      "Def occurrence must be in the given scope"
    )
    assert(
      scope.allDefinitions.contains(defOcc),
      "The given scope must contain the given Def occurrence"
    )
    val idxInScope = scope.allDefinitions.zipWithIndex
      .find { case (def_, _) => def_.id == defOcc.id }
      .map(_._2)
      .getOrElse(
        throw new IllegalStateException(
          "Def occurrence must be in the given scope"
        )
      )
    idxInScope + LocalScope.internalSlotsSize
  }

  /** Returns the *scope distance* of the given `childScope` to the given `parentScope`.
    * Scope distance is the number of parents from the `childScope`.
    * @param parentScope Some of the parent scopes of `childScope`.
    * @param childScope Nested child scope of `parentScope`.
    * @return
    */
  private def getScopeDistance(
    parentScope: Graph.Scope,
    childScope: Graph.Scope
  ): Int = {
    var currScope: Option[Graph.Scope] = Some(childScope)
    var scopeDistance                  = 0
    while (currScope.isDefined && currScope.get != parentScope) {
      currScope = currScope.get.parent
      scopeDistance += 1
    }
    scopeDistance
  }

  private def getAliasAnalysisMeta(
    ir: IR
  ): Option[AliasAnalysis.Metadata] = {
    ir.passData.get(AliasAnalysis) match {
      case Some(aliasInfo: Info) =>
        Some(aliasInfo)
      case _ => None
    }
  }

  private def getAliasRootScope(
    ir: IR
  ): Option[Info.Scope.Root] = {
    ir.passData().get(AliasAnalysis) match {
      case Some(root: Info.Scope.Root) => Some(root)
      case _                           => None
    }
  }

  private def getAliasAnalysisGraph(
    ir: IR
  ): Option[Graph] = {
    getAliasAnalysisMeta(ir).map(_.graph)
  }

  /** Not implemented for this pass.
    */
  override def runExpression(
    ir: Expression,
    inlineContext: InlineContext
  ): Expression = {
    ir
  }

  // === Pass Configuration ===================================================

  class FramePointerMeta(
    val framePointer: FramePointer
  ) extends IRMetadata {
    override val metadataName: String = "FramePointer"

    /** @inheritdoc
      */
    override def duplicate(): Option[Metadata] = {
      Some(new FramePointerMeta(framePointer))
    }

    /** @inheritdoc
      */
    override def prepareForSerialization(
      compiler: CompilerContext
    ): ProcessingPass.Metadata = this

    /** @inheritdoc
      */
    override def restoreFromSerialization(
      compiler: CompilerContext
    ): Option[ProcessingPass.Metadata] = Some(this)

    override def toString: String = s"FramePointerMeta($framePointer)"
  }
}
