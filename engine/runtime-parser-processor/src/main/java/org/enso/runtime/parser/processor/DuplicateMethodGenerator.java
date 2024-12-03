package org.enso.runtime.parser.processor;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.type.TypeKind;
import org.enso.runtime.parser.processor.field.Field;

/**
 * Code generator for {@code org.enso.compiler.core.ir.IR#duplicate} method or any of its override.
 * Note that in the interface hierarchy, there can be an override with a different return type.
 */
class DuplicateMethodGenerator {
  private final ExecutableElement duplicateMethod;
  private final GeneratedClassContext ctx;
  private static final List<Parameter> parameters =
      List.of(
          new Parameter("boolean", "keepLocations"),
          new Parameter("boolean", "keepMetadata"),
          new Parameter("boolean", "keepDiagnostics"),
          new Parameter("boolean", "keepIdentifiers"));

  /**
   * @param duplicateMethod ExecutableElement representing the duplicate method (or its override).
   */
  DuplicateMethodGenerator(ExecutableElement duplicateMethod, GeneratedClassContext ctx) {
    ensureDuplicateMethodHasExpectedSignature(duplicateMethod);
    this.ctx = Objects.requireNonNull(ctx);
    this.duplicateMethod = Objects.requireNonNull(duplicateMethod);
  }

  private static void ensureDuplicateMethodHasExpectedSignature(ExecutableElement duplicateMethod) {
    var dupMethodParameters = duplicateMethod.getParameters();
    if (dupMethodParameters.size() != parameters.size()) {
      throw new IllegalArgumentException(
          "Duplicate method must have " + parameters.size() + " parameters");
    }
    var allParamsAreBooleans =
        dupMethodParameters.stream().allMatch(par -> par.asType().getKind() == TypeKind.BOOLEAN);
    if (!allParamsAreBooleans) {
      throw new IllegalArgumentException(
          "All parameters of the duplicate method must be of type boolean");
    }
  }

  String generateDuplicateMethodCode() {
    var sb = new StringBuilder();
    sb.append("@Override").append(System.lineSeparator());
    sb.append("public ")
        .append(dupMethodRetType())
        .append(" duplicate(")
        .append(parameters.stream().map(Parameter::toString).collect(Collectors.joining(", ")))
        .append(") {")
        .append(System.lineSeparator());
    var duplicatedVars = new ArrayList<DuplicateVar>();

    var duplicateMetaFieldsCode =
        """
        $diagType diagnosticsDuplicated;
        if (keepDiagnostics) {
          diagnosticsDuplicated = this.diagnostics;
        } else {
          diagnosticsDuplicated = null;
        }
        $metaType passDataDuplicated;
        if (keepMetadata) {
          passDataDuplicated = this.passData;
        } else {
          passDataDuplicated = null;
        }
        $locType locationDuplicated;
        if (keepLocations) {
          locationDuplicated = this.location;
        } else {
          locationDuplicated = null;
        }
        $idType idDuplicated;
        if (keepIdentifiers) {
          idDuplicated = this.id;
        } else {
          idDuplicated = null;
        }
        """
            .replace("$locType", ctx.getLocationMetaField().type())
            .replace("$metaType", ctx.getPassDataMetaField().type())
            .replace("$diagType", ctx.getDiagnosticsMetaField().type())
            .replace("$idType", ctx.getIdMetaField().type());
    sb.append(Utils.indent(duplicateMetaFieldsCode, 2));
    sb.append(System.lineSeparator());
    for (var dupMetaVarName :
        List.of(
            "diagnosticsDuplicated", "passDataDuplicated", "locationDuplicated", "idDuplicated")) {
      duplicatedVars.add(new DuplicateVar(null, dupMetaVarName, false));
    }

    for (var field : ctx.getUserFields()) {
      if (field.isChild()) {
        if (field.isNullable()) {
          sb.append(Utils.indent(nullableChildCode(field), 2));
          sb.append(System.lineSeparator());
          duplicatedVars.add(
              new DuplicateVar(field.getSimpleTypeName(), dupFieldName(field), true));
        } else if (!field.isNullable() && !field.isList()) {
          sb.append(Utils.indent(notNullableChildCode(field), 2));
          sb.append(System.lineSeparator());
          duplicatedVars.add(
              new DuplicateVar(field.getSimpleTypeName(), dupFieldName(field), true));
        } else if (field.isList()) {
          sb.append(Utils.indent(listChildCode(field), 2));
          sb.append(System.lineSeparator());
          duplicatedVars.add(new DuplicateVar(null, dupFieldName(field), false));
        }
      } else {
        sb.append(Utils.indent(nonChildCode(field), 2));
        sb.append(System.lineSeparator());
        duplicatedVars.add(new DuplicateVar(field.getSimpleTypeName(), dupFieldName(field), false));
      }
    }

    sb.append(Utils.indent(returnStatement(duplicatedVars), 2));
    sb.append(System.lineSeparator());
    sb.append("}");
    sb.append(System.lineSeparator());
    return sb.toString();
  }

  private static String dupFieldName(Field field) {
    return field.getName() + "Duplicated";
  }

  private static String nullableChildCode(Field nullableChild) {
    assert nullableChild.isNullable() && nullableChild.isChild();
    return """
          IR $dupName = null;
            if ($childName != null) {
              $dupName = $childName.duplicate($parameterNames);
              if (!($dupName instanceof $childType)) {
                throw new IllegalStateException("Duplicated child is not of the expected type: " + $dupName);
              }
          }
        """
        .replace("$childType", nullableChild.getSimpleTypeName())
        .replace("$childName", nullableChild.getName())
        .replace("$dupName", dupFieldName(nullableChild))
        .replace("$parameterNames", String.join(", ", parameterNames()));
  }

  private static String notNullableChildCode(Field child) {
    assert child.isChild() && !child.isNullable() && !child.isList();
    return """
          IR $dupName = $childName.duplicate($parameterNames);
          if (!($dupName instanceof $childType)) {
            throw new IllegalStateException("Duplicated child is not of the expected type: " + $dupName);
          }
          """
        .replace("$childType", child.getSimpleTypeName())
        .replace("$childName", child.getName())
        .replace("$dupName", dupFieldName(child))
        .replace("$parameterNames", String.join(", ", parameterNames()));
  }

  private static String listChildCode(Field listChild) {
    assert listChild.isChild() && listChild.isList();
    return """
          $childListType $dupName =
            $childName.map(child -> {
              IR dupChild = child.duplicate($parameterNames);
              if (!(dupChild instanceof $childType)) {
                throw new IllegalStateException("Duplicated child is not of the expected type: " + dupChild);
              }
              return ($childType) dupChild;
            });
          """
        .replace("$childListType", listChild.getSimpleTypeName())
        .replace("$childType", listChild.getTypeParameter())
        .replace("$childName", listChild.getName())
        .replace("$dupName", dupFieldName(listChild))
        .replace("$parameterNames", String.join(", ", parameterNames()));
  }

  private static String nonChildCode(Field field) {
    assert !field.isChild();
    return """
        $childType $dupName = $childName;
        """
        .replace("$childType", field.getSimpleTypeName())
        .replace("$childName", field.getName())
        .replace("$dupName", dupFieldName(field));
  }

  private static List<String> parameterNames() {
    return parameters.stream().map(Parameter::name).collect(Collectors.toList());
  }

  private String returnStatement(List<DuplicateVar> duplicatedVars) {
    Utils.hardAssert(
        duplicatedVars.size() == ctx.getConstructorParameters().size(),
        "Number of duplicated variables must be equal to the number of constructor parameters");
    var argList =
        duplicatedVars.stream()
            .map(
                var -> {
                  if (var.needsCast) {
                    return "(" + var.type + ") " + var.name;
                  } else {
                    return var.name;
                  }
                })
            .collect(Collectors.joining(", "));
    return "return new " + ctx.getClassName() + "(" + argList + ");";
  }

  private String dupMethodRetType() {
    return duplicateMethod.getReturnType().toString();
  }

  private static String stripWhitespaces(String s) {
    return s.replaceAll("\\s+", "");
  }

  /**
   * @param type Nullable
   * @param name
   * @param needsCast If the duplicated variable needs to be casted to its type in the return
   *     statement.
   */
  private record DuplicateVar(String type, String name, boolean needsCast) {}

  /**
   * Parameter for the duplicate method
   *
   * @param type
   * @param name
   */
  private record Parameter(String type, String name) {

    @Override
    public String toString() {
      return type + " " + name;
    }
  }
}
