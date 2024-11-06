package org.enso.compiler.core.ir;

import java.util.function.Function;
import org.enso.compiler.core.IR;
import org.enso.compiler.core.ir.JExpressionGen.IfThenElseGen;
import org.enso.runtime.parser.dsl.IRChild;
import org.enso.runtime.parser.dsl.IRCopyMethod;
import org.enso.runtime.parser.dsl.IRNode;
import scala.Option;
import scala.collection.immutable.List;

@IRNode
public interface JExpression extends IR {

  @Override
  JExpression mapExpressions(Function<Expression, Expression> fn);

  @Override
  JExpression duplicate(
      boolean keepLocations,
      boolean keepMetadata,
      boolean keepDiagnostics,
      boolean keepIdentifiers);

  interface JBlock extends JExpression {
    @IRChild
    List<JExpression> expressions();

    @IRChild
    JExpression returnValue();

    boolean suspended();
  }

  /**
   * A binding expression of the form `name = expr`
   *
   * <p>To create a binding that binds no available name, set the name of the binding to an
   * [[Name.Blank]] (e.g. _ = foo a b).
   */
  interface JBinding extends JExpression {
    @IRChild
    JName name();

    @IRChild
    JExpression expression();
  }
}
