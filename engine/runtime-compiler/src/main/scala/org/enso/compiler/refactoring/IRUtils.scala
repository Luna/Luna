package org.enso.compiler.refactoring

import org.enso.compiler.core.Implicits.AsMetadata
import org.enso.compiler.core.{ExternalID, IR, Identifier}
import org.enso.compiler.core.ir.{CallArgument, Name}
import org.enso.compiler.core.ir.expression.Application
import org.enso.compiler.data.BindingsMap
import org.enso.compiler.pass.analyse.DataflowAnalysis
import org.enso.compiler.pass.resolve.MethodCalls
import org.enso.pkg.QualifiedName

import java.util.UUID

trait IRUtils {

  /** Find the node by external id.
    *
    * @param ir the syntax tree
    * @param externalId the external id to look for
    * @return the first node with the given external id in `ir`
    */
  def findByExternalId(ir: IR, externalId: UUID @ExternalID): Option[IR] = {
    IR.preorder(
      ir,
      { ir =>
        if (ir.getExternalId.contains(externalId)) {
          return Some(ir)
        }
      }
    )
    None
  }

  /** Find usages of a local defined in the body block.
    *
    * @param ir the syntax tree
    * @param literal the literal name of the local
    * @return the list of usages of the given literal in the `ir`
    */
  def findLocalUsages(
    ir: IR,
    literal: Name.Literal
  ): Option[Set[Name.Literal]] = {
    for {
      usages <- findStaticUsages(ir, literal)
    } yield {
      usages.collect {
        case usage: Name.Literal if usage.name == literal.name => usage
      }
    }
  }

  /** Find usages of a method defined on module.
    *
    * @param moduleName the qualified module name
    * @param ir the syntax tree
    * @param node the name of the method
    * @return the list of usages of the given method in the `ir`
    */
  def findModuleMethodUsages(
    moduleName: QualifiedName,
    ir: IR,
    node: Name
  ): Option[Set[Name.Literal]] =
    for {
      usages <- findDynamicUsages(ir, node)
    } yield {
      usages.collect {
        case Application.Prefix(function: Name.Literal, args, _, _, _)
            if function.name == node.name =>
          function.getMetadata(MethodCalls) match {
            case Some(resolution) =>
              resolution.target match {
                case BindingsMap.ResolvedModuleMethod(module, _)
                    if module.getName == moduleName =>
                  Some(function)
                case _ =>
                  None
              }
            case None =>
              args.headOption match {
                case Some(arg) if isSyntheticArgument(arg) =>
                  Some(function)
                case _ =>
                  None
              }
          }
      }.flatten
    }

  /** Check if the provided argument is synthetic.
    *
    * @param argument the call argument
    * @return `true` if the provided argument is synthetic
    */
  private def isSyntheticArgument(argument: CallArgument): Boolean = {
    val argName = argument.value.showCode()
    argName.startsWith("<") && argName.endsWith(">")
  }

  /** Find usages of a static dependency in the [[DataflowAnalysis]] metadata.
    *
    * @param ir the syntax tree
    * @param literal the name to look for
    * @return the list of usages of the given name in the `ir`
    */
  private def findStaticUsages(
    ir: IR,
    literal: Name.Literal
  ): Option[Set[IR]] = {
    for {
      metadata <- ir.getMetadata(DataflowAnalysis)
      key = DataflowAnalysis.DependencyInfo.Type
        .Static(literal.getId(), literal.getExternalId)
      dependents <- metadata.dependents.get(key)
    } yield {
      dependents
        .flatMap {
          case _: DataflowAnalysis.DependencyInfo.Type.Dynamic =>
            None
          case DataflowAnalysis.DependencyInfo.Type.Static(id, _) =>
            findById(ir, id)
        }
    }
  }

  /** Find usages of a dynamic dependency in the [[DataflowAnalysis]] metadata.
    *
    * @param ir the syntax tree
    * @param node the name to look for
    * @return the list of usages of the given name in the `ir`
    */
  private def findDynamicUsages(
    ir: IR,
    node: Name
  ): Option[Set[IR]] = {
    for {
      metadata <- ir.getMetadata(DataflowAnalysis)
      key = DataflowAnalysis.DependencyInfo.Type.Dynamic(node.name, None)
      dependents <- metadata.dependents.get(key)
    } yield {
      dependents
        .flatMap {
          case _: DataflowAnalysis.DependencyInfo.Type.Dynamic =>
            None
          case DataflowAnalysis.DependencyInfo.Type.Static(id, _) =>
            findById(ir, id)
        }
    }
  }

  /** Find node by id.
    *
    * @param ir the syntax tree
    * @param id the identifier to look for
    * @return the `ir` node with the given identifier
    */
  private def findById(ir: IR, id: UUID @Identifier): Option[IR] = {
    IR.preorder(
      ir,
      { ir =>
        if (ir.getId == id) {
          return Some(ir)
        }
      }
    )
    None
  }
}

object IRUtils extends IRUtils
