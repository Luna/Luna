package org.enso.runtime.parser.processor;

final class EqualsMethodGenerator {
  private final GeneratedClassContext ctx;

  EqualsMethodGenerator(GeneratedClassContext ctx) {
    this.ctx = ctx;
  }

  String generateMethodCode() {
    var sb = new StringBuilder();
    sb.append("@Override").append(System.lineSeparator());
    sb.append("public boolean equals(Object o) {").append(System.lineSeparator());
    sb.append("  if (this == o) {").append(System.lineSeparator());
    sb.append("    return true;").append(System.lineSeparator());
    sb.append("  }").append(System.lineSeparator());
    sb.append("  if (o instanceof ")
        .append(ctx.getClassName())
        .append(" other) {")
        .append(System.lineSeparator());
    for (var field : ctx.getAllFields()) {
      sb.append(
              "    if (!(Objects.equals(this.$name, other.$name))) {"
                  .replace("$name", field.name()))
          .append(System.lineSeparator());
      sb.append("      return false;").append(System.lineSeparator());
      sb.append("    }").append(System.lineSeparator());
    }
    sb.append("    return true;").append(System.lineSeparator());
    sb.append("  }").append(System.lineSeparator());
    sb.append("  return false;").append(System.lineSeparator());
    sb.append("}").append(System.lineSeparator());
    return Utils.indent(sb.toString(), 2);
  }
}
