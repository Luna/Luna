package org.enso.compiler.pass.analyse

import org.enso.compiler.context.{InlineContext, ModuleContext}
import org.enso.compiler.core.Implicits.AsMetadata
import org.enso.compiler.core.IR
import org.enso.compiler.core.ir.{
  DefinitionArgument,
  Diagnostic,
  Expression,
  Module
}
import org.enso.compiler.core.ir.module.scope.definition
import org.enso.compiler.core.ir.MetadataStorage._
import org.enso.compiler.pass.IRPass
import org.enso.compiler.pass.resolve.{GenericAnnotations, TypeSignatures}

import java.util.function.Consumer

import scala.collection.mutable

/** A pass that traverses the given root IR and accumulates all the encountered
  * diagnostic nodes in the root.
  *
  * This pass requires the context to provide:
  *
  * - Nothing
  */
case object GatherDiagnostics extends IRPass {
  override type Metadata = DiagnosticsMeta
  override type Config   = IRPass.Configuration.Default

  override lazy val precursorPasses: Seq[IRPass]   = List(TypeSignatures)
  override lazy val invalidatedPasses: Seq[IRPass] = List()

  /** Executes the pass on the provided `ir`, and attaches all the encountered
    * diagnostics to its metadata storage.
    *
    * @param ir the Enso IR to process
    * @param moduleContext a context object that contains the information needed
    *                      to process a module
    * @return `ir`, possibly having made transformations or annotations to that
    *         IR.
    */
  override def runModule(
    ir: Module,
    moduleContext: ModuleContext
  ): Module =
    ir.updateMetadata(new MetadataPair(this, gatherMetadata(ir)))

  /** Executes the pass on the provided `ir`, and attaches all the encountered
    * diagnostics to its metadata storage.
    *
    * @param ir the IR to process
    * @param inlineContext a context object that contains the information needed
    *                      for inline evaluation
    * @return `ir` with all the errors accumulated in pass metadata.
    */
  override def runExpression(
    ir: Expression,
    inlineContext: InlineContext
  ): Expression = ir.updateMetadata(new MetadataPair(this, gatherMetadata(ir)))

  /** Gathers diagnostics from all children of an IR node.
    *
    * @param ir the node to gather diagnostics from
    * @return `ir`, with all diagnostics from its subtree associated with it
    */
  private def gatherMetadata(ir: IR): DiagnosticsMeta = {
    val builder = List.newBuilder[Diagnostic]
    IR.preorder(
      ir,
      {
        case err: Diagnostic =>
          builder.addOne(err)
        case arg: DefinitionArgument =>
          arg
            .getMetadata(TypeSignatures)
            .foreach(meta =>
              IR.preorder(meta.signature, collectDiagnostics(builder))
            )
          diagnosticsList(arg).foreach(builder.addOne)
        case x: definition.Method =>
          x.getMetadata(TypeSignatures)
            .foreach(meta =>
              IR.preorder(meta.signature, collectDiagnostics(builder))
            )
          x.getMetadata(GenericAnnotations)
            .foreach(
              _.annotations.foreach(annotations =>
                IR.preorder(annotations, collectDiagnostics(builder))
              )
            )
          diagnosticsList(x).foreach(builder.addOne)
        case x: Expression =>
          x.getMetadata(TypeSignatures)
            .foreach(meta =>
              IR.preorder(meta.signature, collectDiagnostics(builder))
            )
          diagnosticsList(x).foreach(builder.addOne)
        case x =>
          diagnosticsList(x).foreach(builder.addOne)
      }: Consumer[IR]
    )

    DiagnosticsMeta(
      builder.result().distinctBy(d => new DiagnosticKeys(d))
    )
  }

  private def collectDiagnostics(
    builder: mutable.Builder[Diagnostic, List[Diagnostic]]
  ): Consumer[IR] = {
    case err: Diagnostic =>
      builder.addOne(err)
    case _ =>
  }

  private def diagnosticsList(ir: IR): List[Diagnostic] =
    if (ir.diagnostics() eq null) Nil else ir.diagnostics().toList

  final private class DiagnosticKeys(private val diagnostic: Diagnostic) {

    /** Equals is based on type of diagnostic, its location and its diagnostic keys.
      */
    override def equals(any: Any): Boolean = any match {
      case other: DiagnosticKeys =>
        diagnostic.getClass == other.diagnostic.getClass &&
        diagnostic.location == other.diagnostic.location &&
        java.util.Arrays.equals(
          diagnostic.diagnosticKeys(),
          other.diagnostic.diagnosticKeys()
        )
      case _ => false
    }

    /** Hascode computed from location and provided diagnostic keys */
    override def hashCode(): Int = {
      var sum = diagnostic.location.hashCode
      for (k <- diagnostic.diagnosticKeys()) {
        sum += k.hashCode
      }

      sum
    }
  }

  /** A container for diagnostics found in the IR.
    *
    * @param diagnostics a list of the errors found in the IR
    */
  case class DiagnosticsMeta(diagnostics: List[Diagnostic])
      extends IRPass.IRMetadata {

    /** The name of the metadata as a string. */
    override val metadataName: String = "GatherDiagnostics.Diagnostics"

    override def duplicate(): Option[IRPass.IRMetadata] =
      Some(this)

    /** @inheritdoc */
    override def prepareForSerialization(compiler: Compiler): DiagnosticsMeta =
      this

    /** @inheritdoc */
    override def restoreFromSerialization(
      compiler: Compiler
    ): Option[DiagnosticsMeta] = Some(this)
  }
}
