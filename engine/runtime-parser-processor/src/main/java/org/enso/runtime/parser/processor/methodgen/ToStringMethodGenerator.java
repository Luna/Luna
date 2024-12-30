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
    var sb = new StringBuilder();
    sb.append("@Override").append(System.lineSeparator());
    sb.append("public String toString() {").append(System.lineSeparator());
    sb.append("  return ").append(System.lineSeparator());
    sb.append("    ").append(quoted(className())).append(System.lineSeparator());
    sb.append("    + ").append(quoted("(")).append(System.lineSeparator());
    var fieldsStrRepr =
        ctx.getAllFields().stream()
            .map(field -> "    \"$fieldName = \" + $fieldName".replace("$fieldName", field.name()))
            .collect(Collectors.joining(" + \", \" + " + System.lineSeparator()));
    sb.append("    + ").append(fieldsStrRepr).append(System.lineSeparator());
    sb.append("    + ").append(quoted(")")).append(";").append(System.lineSeparator());
    sb.append("}").append(System.lineSeparator());
    return sb.toString();
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
