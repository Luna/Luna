package org.enso.runtime.parser.processor;

import java.util.stream.Collectors;
import org.enso.runtime.parser.processor.GeneratedClassContext.ClassField;

final class HashCodeMethodGenerator {
  private final GeneratedClassContext ctx;

  HashCodeMethodGenerator(GeneratedClassContext ctx) {
    this.ctx = ctx;
  }

  String generateMethodCode() {
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
