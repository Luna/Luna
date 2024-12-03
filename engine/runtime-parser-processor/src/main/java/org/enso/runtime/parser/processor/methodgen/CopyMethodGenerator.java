package org.enso.runtime.parser.processor.methodgen;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.VariableElement;
import org.enso.runtime.parser.dsl.IRCopyMethod;
import org.enso.runtime.parser.processor.GeneratedClassContext;
import org.enso.runtime.parser.processor.GeneratedClassContext.ClassField;
import org.enso.runtime.parser.processor.Utils;

/** Code generator for methods annotated with {@link IRCopyMethod}. */
public class CopyMethodGenerator {
  private final ExecutableElement copyMethod;
  private final GeneratedClassContext ctx;
  private final Map<VariableElement, ClassField> parameterMapping = new HashMap<>();

  public CopyMethodGenerator(ExecutableElement copyMethod, GeneratedClassContext ctx) {
    this.ctx = ctx;
    ensureIsAnnotated(copyMethod);
    this.copyMethod = Objects.requireNonNull(copyMethod);
    for (var parameter : copyMethod.getParameters()) {
      var parName = parameter.getSimpleName();
      var parType = simpleTypeName(parameter);
      ctx.getAllFields().stream()
          .filter(field -> field.type().equals(parType))
          .filter(field -> field.name().equals(parName.toString()))
          .findFirst()
          .ifPresentOrElse(
              field -> parameterMapping.put(parameter, field),
              () -> {
                var msg =
                    "Parameter "
                        + parName
                        + " of type "
                        + parType
                        + " in the copy method "
                        + "does not have a corresponding field in the interface "
                        + ctx.getIrNodeInterface().getQualifiedName().toString()
                        + ". Ensure there is a parameterless abstract method of the same return"
                        + " type. For more information, see @IRNode annotation docs.";
                Utils.printError(msg, parameter, ctx.getProcessingEnvironment().getMessager());
                throw new IllegalArgumentException(msg);
              });
    }
    Utils.hardAssert(parameterMapping.size() == copyMethod.getParameters().size());
  }

  private static void ensureIsAnnotated(ExecutableElement copyMethod) {
    if (copyMethod.getAnnotation(IRCopyMethod.class) == null) {
      throw new IllegalArgumentException("Copy method must be annotated with @IRCopyMethod");
    }
  }

  private String simpleTypeName(VariableElement parameter) {
    return ctx.getProcessingEnvironment()
        .getTypeUtils()
        .asElement(parameter.asType())
        .getSimpleName()
        .toString();
  }

  public String generateCopyMethod() {
    var sb = new StringBuilder();
    sb.append("@Override").append(System.lineSeparator());
    var argList =
        copyMethod.getParameters().stream()
            .map(
                parameter -> simpleTypeName(parameter) + " " + parameter.getSimpleName().toString())
            .collect(Collectors.joining(", "));
    sb.append("public ")
        .append(copyMethod.getReturnType())
        .append(" ")
        .append(copyMethod.getSimpleName())
        .append("(")
        .append(argList)
        .append(") {")
        .append(System.lineSeparator());
    sb.append("  var builder = new Builder(this);").append(System.lineSeparator());
    for (var entry : parameterMapping.entrySet()) {
      var parameter = entry.getKey();
      var classField = entry.getValue();
      sb.append("  builder.")
          .append(classField.name())
          .append(" = ")
          .append(parameter.getSimpleName())
          .append(";")
          .append(System.lineSeparator());
    }
    sb.append("  var ret = builder.build();").append(System.lineSeparator());
    sb.append("  return ret;").append(System.lineSeparator());
    sb.append("}").append(System.lineSeparator());
    return sb.toString();
  }
}
