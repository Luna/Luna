package org.enso.runtime.parser.processor.test.gen.ir.module.scope;

import org.enso.compiler.core.ir.JName;
import org.enso.compiler.core.ir.module.JScope;
import org.enso.runtime.parser.dsl.IRChild;
import org.enso.runtime.parser.dsl.IRNode;
import scala.collection.immutable.List;

@IRNode
public interface JExport extends JScope {
  interface JModule extends JExport {
    @IRChild
    JName.JQualified name();

    @IRChild(required = false)
    JName.JLiteral rename();

    @IRChild(required = false)
    List<JName.JLiteral> onlyNames();

    boolean isSynthetic();

    /**
     * Gets the name of the module visible in the importing scope, either the original name or the
     * rename.
     *
     * @return the name of this export visible in code
     */
    default JName getSimpleName() {
      if (rename() != null) {
        return rename();
      } else {
        return name().parts().apply(name().parts().size() - 1);
      }
    }

    /**
     * Checks whether the export statement allows use of the given exported name.
     *
     * <p>Note that it does not verify if the name is actually exported by the module, only checks
     * if it is syntactically allowed.
     *
     * @param name the name to check
     * @return whether the name could be accessed or not
     */
    default boolean allowsAccess(String name) {
      if (onlyNames() != null) {
        return onlyNames().exists(n -> n.name().equalsIgnoreCase(name));
      }
      return true;
    }
  }
}
