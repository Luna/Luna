package org.enso.runtime.parser.processor.methodgen;

import java.util.stream.Collectors;
import javax.lang.model.element.ElementKind;
import org.enso.runtime.parser.processor.GeneratedClassContext;

public class ToStringMethodGenerator {
  private final GeneratedClassContext ctx;

  public ToStringMethodGenerator(GeneratedClassContext ctx) {
    this.ctx = ctx;
  }

  public String generateMethodCode() {
    var docs =
        """
        /**
         * Returns a one-line string representation of this IR object.
         */
        """;
    var sb = new StringBuilder();
    sb.append(docs);
    sb.append("@Override").append(System.lineSeparator());
    sb.append("public String toString() {").append(System.lineSeparator());
    sb.append("  String ret = ").append(System.lineSeparator());
    sb.append("    ").append(quoted(className())).append(System.lineSeparator());
    sb.append("    + ").append(quoted("(")).append(System.lineSeparator());
    var fieldsStrRepr =
        ctx.getAllFields().stream()
            .map(field -> "    \"$fieldName = \" + $fieldName".replace("$fieldName", field.name()))
            .collect(Collectors.joining(" + \", \" + " + System.lineSeparator()));
    sb.append("    + ").append(fieldsStrRepr).append(System.lineSeparator());
    sb.append("    + ").append(quoted(")")).append(";").append(System.lineSeparator());
    sb.append("  return toSingleLine(ret);").append(System.lineSeparator());
    sb.append("}").append(System.lineSeparator());

    sb.append(toSingleLineMethod()).append(System.lineSeparator());
    return sb.toString();
  }

  private String toSingleLineMethod() {
    return """
        private static String toSingleLine(String str) {
          String[] lines = str.trim().split(System.lineSeparator());
          var body = new StringBuilder();
          for (int i = 1; i < lines.length - 1; i++) {
            body.append(lines[i].trim());
            body.append(" ");
          }
          return lines[0] + body.toString().trim() + lines[lines.length - 1];
        }
        """;
  }

  private String className() {
    var clazz = ctx.getProcessedClass().getClazz();
    var enclosingElem = clazz.getEnclosingElement();
    if (enclosingElem.getKind() == ElementKind.INTERFACE
        || enclosingElem.getKind() == ElementKind.CLASS) {
      return enclosingElem.getSimpleName().toString() + "." + clazz.getSimpleName().toString();
    } else {
      return clazz.getSimpleName().toString();
    }
  }

  private static String quoted(String str) {
    return '"' + str + '"';
  }
}
