package org.enso.runtime.parser.processor.test.gen.ir.module.scope;

import org.enso.compiler.core.IR;
import org.enso.runtime.parser.dsl.IRChild;
import org.enso.runtime.parser.dsl.IRNode;
import org.enso.runtime.parser.processor.test.gen.ir.JDefinitionArgument;
import org.enso.runtime.parser.processor.test.gen.ir.JName;
import org.enso.runtime.parser.processor.test.gen.ir.module.JScope;
import scala.collection.immutable.List;

@IRNode
public interface JDefinition extends JScope {
  interface JType extends JDefinition {
    @IRChild
    JName name();

    @IRChild
    List<JDefinitionArgument> params();

    @IRChild
    List<JData> members();
  }

  /** The definition of an atom constructor and its associated arguments. */
  interface JData extends JDefinition {
    /** The name of the atom */
    @IRChild
    JName name();

    /** The arguments of the atom constructor. */
    @IRChild
    List<JDefinitionArgument> arguments();

    @IRChild
    List<JName.JGenericAnnotation> annotations();

    /** If the constructor is project-private. */
    boolean isPrivate();
  }

  /**
   * The definition of a complex type definition that may contain multiple atom and method
   * definitions.
   */
  interface JSugaredType extends JDefinition {

    /** The name of the complex type. */
    @IRChild
    JName name();

    @IRChild
    List<JDefinitionArgument> arguments();

    @IRChild
    List<IR> body();
  }
}
