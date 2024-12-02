package org.enso.runtime.parser.processor.test.gen.ir.core;

import org.enso.runtime.parser.dsl.IRChild;
import org.enso.runtime.parser.dsl.IRNode;
import org.enso.runtime.parser.processor.test.gen.ir.module.scope.JDefinition;
import scala.collection.immutable.List;

@IRNode
public interface JName extends JExpression {
  String name();

  boolean isMethod();

  @Override
  JName duplicate(
      boolean keepLocations,
      boolean keepMetadata,
      boolean keepDiagnostics,
      boolean keepIdentifiers);

  interface JBlank extends JName {
    static JBlank create() {
      return JNameGen.JBlankGen.builder().build();
    }
  }

  interface JLiteral extends JName {
    @IRChild(required = false)
    JName originalName();
  }

  interface JQualified extends JName {
    @IRChild
    List<JName> parts();

    @Override
    default String name() {
      return parts().map(JName::name).mkString(".");
    }
  }

  interface JSelf extends JName {
    boolean synthetic();
  }

  interface JAnnotation extends JName, JDefinition {}

  interface JGenericAnnotation extends JAnnotation {
    @IRChild
    JExpression expression();
  }
}
