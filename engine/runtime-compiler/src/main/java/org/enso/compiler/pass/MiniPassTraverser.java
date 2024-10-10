package org.enso.compiler.pass;

import java.util.ArrayList;
import java.util.Arrays;
import org.enso.compiler.context.ModuleContext;
import org.enso.compiler.core.CompilerError;
import org.enso.compiler.core.IR;
import org.enso.compiler.core.ir.Expression;
import org.enso.compiler.core.ir.Module;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class MiniPassTraverser {
  private MiniPassTraverser() {}

  private static final Logger logger = LoggerFactory.getLogger(MiniPassTraverser.class);

  /**
   * Compiles the whole module with chained {@link MiniIRPass}.
   *
   * @param miniPass Mini pass that must support module compilation, i.e., should be created with
   *     {@link MiniPassFactory#createForModuleCompilation(ModuleContext)}.
   * @return Transformed module IR.
   */
  public static Module compileModuleWithMiniPass(Module moduleIr, MiniIRPass miniPass) {
    var preparedMiniPass = miniPass.prepareForModule(moduleIr);
    logPrepare(moduleIr, miniPass, preparedMiniPass);
    var newChildren = new ArrayList<Expression>();
    boolean[] childrenChanged = {false};
    moduleIr.mapExpressions(
        (ch) -> {
          var newChild = compileRecursively(ch, preparedMiniPass);
          newChildren.add(newChild);
          if (ch != newChild) {
            childrenChanged[0] = true;
          }
          return newChild;
        });
    if (childrenChanged[0]) {
      var index = new int[1];
      moduleIr.mapExpressions((old) -> newChildren.get(index[0]++));
    }
    var newModuleIr = miniPass.transformModule(moduleIr);
    return newModuleIr;
  }

  public static Expression compileInlineWithMiniPass(Expression exprIr, MiniIRPass miniPass) {
    var preparedMiniPass = miniPass.prepare(exprIr);
    var newIr = compileRecursively(exprIr, preparedMiniPass);
    if (!preparedMiniPass.checkPostCondition(newIr)) {
      throw new CompilerError("Post condition failed after applying mini pass " + preparedMiniPass);
    }
    return newIr;
  }

  private static Expression compileRecursively(Expression expr, MiniIRPass miniPass) {
    var preparedMiniPass = miniPass.prepare(expr);
    logPrepare(expr, miniPass, preparedMiniPass);
    Expression newIr;
    var childExpressions = new ArrayList<Expression>();
    expr.mapExpressions(
        (ch) -> {
          childExpressions.add(ch);
          return ch;
        });
    if (childExpressions.isEmpty()) {
      newIr = expr;
    } else {
      var changed = false;
      for (var i = 0; i < childExpressions.size(); i++) {
        var child = childExpressions.get(i);
        var newChild = compileRecursively(child, preparedMiniPass);
        if (child == newChild) {
          continue;
        }
        changed = true;
        if (!preparedMiniPass.checkPostCondition(newChild)) {
          throw new CompilerError(
              "Post condition failed after applying mini pass " + preparedMiniPass);
        }
        childExpressions.set(i, newChild);
      }
      if (changed) {
        var index = new int[1];
        newIr = expr.mapExpressions((old) -> childExpressions.get(index[0]++));
      } else {
        newIr = expr;
      }
    }
    var transformedIr = preparedMiniPass.transformExpression(newIr);
    logTransform(newIr, preparedMiniPass, transformedIr);
    if (!preparedMiniPass.checkPostCondition(transformedIr)) {
      throw new CompilerError("Post condition failed after applying mini pass " + preparedMiniPass);
    }
    return transformedIr;
  }

  private static void logPrepare(IR ir, MiniIRPass pass, MiniIRPass preparedPass) {
    if (!logger.isTraceEnabled()) {
      return;
    }
    var irName = minifiedClassName(ir);
    var passName = pass.toString();
    if (preparedPass == pass) {
      logger.trace("Prepare({}, {})", passName, irName);
    } else {
      var preparedPassName = preparedPass.toString();
      logger.trace("Prepare({}, {}) -> {}", passName, irName, preparedPassName);
    }
  }

  private static void logTransform(IR ir, MiniIRPass pass, IR newIr) {
    if (!logger.isTraceEnabled()) {
      return;
    }
    var passName = pass.toString();
    var irName = minifiedClassName(ir);
    if (newIr == ir && newIr.passData().size() == ir.passData().size()) {
      logger.trace("Transform({}, {})", passName, irName);
    } else {
      var newIrName = newIr.toString();
      logger.trace("Transform({}, {}) -> {}", passName, irName, newIrName);
    }
  }

  private static String minifiedClassName(Object obj) {
    // How many trailing names should be displayed in full.
    var lastLongNames = 2;
    var nameItems = Arrays.asList(obj.getClass().getName().split("\\."));
    if (nameItems.size() > lastLongNames) {
      var shortNames = nameItems.stream().map(nm -> nm.substring(0, 1)).toList();
      var shortNamesCount = nameItems.size() - lastLongNames;
      return String.join(".", shortNames.subList(0, shortNamesCount))
          + "."
          + String.join(".", nameItems.subList(shortNamesCount, nameItems.size()));
    } else {
      return obj.getClass().getName();
    }
  }
}
