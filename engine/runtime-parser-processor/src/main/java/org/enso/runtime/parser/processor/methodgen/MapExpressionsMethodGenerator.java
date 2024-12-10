package org.enso.runtime.parser.processor.methodgen;

import java.util.Objects;
import javax.lang.model.element.Element;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.TypeElement;
import org.enso.runtime.parser.processor.GeneratedClassContext;
import org.enso.runtime.parser.processor.field.Field;
import org.enso.runtime.parser.processor.utils.Utils;

public final class MapExpressionsMethodGenerator {
  private final ExecutableElement mapExpressionsMethod;
  private final GeneratedClassContext ctx;
  private static final String METHOD_NAME = "mapExpressions";

  /**
   * @param mapExpressionsMethod Reference to {@code mapExpressions} method in the interface for
   *     which the class is generated.
   * @param ctx
   */
  public MapExpressionsMethodGenerator(
      ExecutableElement mapExpressionsMethod, GeneratedClassContext ctx) {
    ensureMapExpressionsMethodHasExpectedSignature(mapExpressionsMethod);
    this.mapExpressionsMethod = mapExpressionsMethod;
    this.ctx = Objects.requireNonNull(ctx);
  }

  private void ensureMapExpressionsMethodHasExpectedSignature(
      ExecutableElement mapExpressionsMethod) {
    var parameters = mapExpressionsMethod.getParameters();
    if (parameters.size() != 1) {
      Utils.printErrorAndFail(
          "Map expressions method must have 1 parameter",
          mapExpressionsMethod,
          ctx.getProcessingEnvironment().getMessager());
    }
  }

  public String generateMapExpressionsMethodCode() {
    var sb = new StringBuilder();
    sb.append("@Override").append(System.lineSeparator());
    sb.append("public ")
        .append(mapExpressionsMethod.getReturnType())
        .append(" ")
        .append(METHOD_NAME)
        .append("(")
        .append("Function<Expression, Expression> fn")
        .append(") {")
        .append(System.lineSeparator());

    var children = ctx.getUserFields().stream().filter(Field::isChild);
    var newChildren =
        children.map(
            child -> {
              ExecutableElement childsMapExprMethod;
              if (child.isList() || child.isOption()) {
                childsMapExprMethod =
                    Utils.findMapExpressionsMethod(
                        child.getTypeParameter(), ctx.getProcessingEnvironment());
              } else {
                childsMapExprMethod =
                    Utils.findMapExpressionsMethod(child.getType(), ctx.getProcessingEnvironment());
              }

              var typeUtils = ctx.getProcessingEnvironment().getTypeUtils();
              var childsMapExprMethodRetType =
                  typeUtils.asElement(childsMapExprMethod.getReturnType());
              var shouldCast =
                  !typeUtils.isSameType(
                      child.getType().asType(), childsMapExprMethodRetType.asType());
              if (child.isList() || child.isOption()) {
                shouldCast = false;
              }

              String newChildType = typeName(childsMapExprMethodRetType);
              if (child.isList()) {
                newChildType = "List<" + newChildType + ">";
              } else if (child.isOption()) {
                newChildType = "Option<" + newChildType + ">";
              }

              var newChildName = child.getName() + "Mapped";
              sb.append("  ").append(newChildType).append(" ").append(newChildName);
              if (child.isNullable()) {
                sb.append(" = null;").append(System.lineSeparator());
                sb.append("  if (")
                    .append(child.getName())
                    .append(" != null) {")
                    .append(System.lineSeparator());
                // childMapped = child.mapExpressions(fn);
                sb.append("    ")
                    .append(newChildName)
                    .append(".")
                    .append(METHOD_NAME)
                    .append("(fn);")
                    .append(System.lineSeparator());
                sb.append("  }").append(System.lineSeparator());
              } else {
                if (!child.isList() && !child.isOption()) {
                  // ChildType childMapped = child.mapExpressions(fn);
                  sb.append(" = ")
                      .append(child.getName())
                      .append(".")
                      .append(METHOD_NAME)
                      .append("(fn);")
                      .append(System.lineSeparator());
                } else {
                  Utils.hardAssert(child.isList() || child.isOption());
                  // List<ChildType> childMapped = child.map(e -> e.mapExpressions(fn));
                  sb.append(" = ")
                      .append(child.getName())
                      .append(".map(e -> e.")
                      .append(METHOD_NAME)
                      .append("(fn));")
                      .append(System.lineSeparator());
                }
              }
              return new MappedChild(newChildName, child, shouldCast);
            });
    sb.append("  ").append("var bldr = new Builder(this);").append(System.lineSeparator());
    newChildren.forEach(
        newChild -> {
          if (newChild.shouldCast) {
            sb.append("  ")
                .append("if (!(")
                .append(newChild.newChildName)
                .append(" instanceof ")
                .append(newChild.child.getType().getSimpleName())
                .append(")) {")
                .append(System.lineSeparator());
            sb.append("    ")
                .append(
                    "throw new IllegalStateException(\"Duplicated child is not of the expected"
                        + " type: \" + ")
                .append(newChild.newChildName)
                .append(");")
                .append(System.lineSeparator());
            sb.append("  }").append(System.lineSeparator());
          }
          sb.append("  ").append("bldr.").append(newChild.child.getName()).append("(");
          if (newChild.shouldCast) {
            sb.append("(").append(newChild.child.getType().getSimpleName()).append(") ");
          }
          sb.append(newChild.newChildName).append(");").append(System.lineSeparator());
        });
    sb.append("  return bldr.build();").append(System.lineSeparator());
    sb.append("}").append(System.lineSeparator());
    return sb.toString();
  }

  private String typeName(Element element) {
    if (element instanceof TypeElement typeElement) {
      return typeElement.getQualifiedName().toString();
    }
    return element.getSimpleName().toString();
  }

  private record MappedChild(String newChildName, Field child, boolean shouldCast) {}
}
