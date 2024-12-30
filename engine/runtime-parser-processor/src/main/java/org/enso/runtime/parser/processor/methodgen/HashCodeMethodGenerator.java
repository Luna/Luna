package org.enso.runtime.parser.processor.methodgen;

import java.util.stream.Collectors;
import org.enso.runtime.parser.processor.GeneratedClassContext;
import org.enso.runtime.parser.processor.GeneratedClassContext.ClassField;
import org.enso.runtime.parser.processor.utils.Utils;

public final class HashCodeMethodGenerator {
  private final GeneratedClassContext ctx;

  public HashCodeMethodGenerator(GeneratedClassContext ctx) {
    this.ctx = ctx;
  }

  public String generateMethodCode() {
    var fieldList =
        ctx.getAllFields().stream().map(ClassField::name).collect(Collectors.joining(", "));
    var code =
        """
        @Override
        public int hashCode() {
          return Objects.hash($fieldList);
        }
        """
            .replace("$fieldList", fieldList);
    return Utils.indent(code, 2);
  }
}