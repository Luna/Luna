package org.enso.runtime.parser.processor.test.gen.ir.module.scope;

import org.enso.compiler.core.ir.JName;
import org.enso.compiler.core.ir.module.JScope;
import org.enso.runtime.parser.dsl.IRChild;
import org.enso.runtime.parser.dsl.IRNode;
import scala.collection.immutable.List;

/** Module-level import statements. */
@IRNode
public interface JImport extends JScope {
  interface JModule extends JImport {
    @IRChild
    JName.JQualified name();

    @IRChild(required = false)
    JName.JLiteral rename();

    boolean isAll();

    @IRChild(required = false)
    List<JName.JLiteral> onlyNames();

    @IRChild(required = false)
    List<JName.JLiteral> hiddenNames();

    boolean isSynthetic();

    /**
     * Checks whether the import statement allows use of the given exported name.
     *
     * <p>Note that it does not verify if the name is actually exported by the module, only checks
     * if it is syntactically allowed.
     *
     * @param name the name to check
     * @return whether the name could be accessed or not
     */
    default boolean allowsAccess(String name) {
      if (!isAll()) {
        return false;
      }
      if (onlyNames() != null) {
        return onlyNames().exists(n -> n.name().equals(name));
      }
      if (hiddenNames() != null) {
        return hiddenNames().forall(n -> !n.name().equals(name));
      }
      return true;
    }
  }
}
