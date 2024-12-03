package org.enso.runtime.parser.processor.methodgen;

import javax.annotation.processing.ProcessingEnvironment;
import javax.lang.model.element.ExecutableElement;
import org.enso.runtime.parser.processor.utils.Utils;

public class SetLocationMethodGenerator {
  private final ExecutableElement setLocationMethod;
  private final ProcessingEnvironment processingEnv;

  public SetLocationMethodGenerator(
      ExecutableElement setLocationMethod, ProcessingEnvironment processingEnv) {
    ensureCorrectSignature(setLocationMethod);
    this.processingEnv = processingEnv;
    this.setLocationMethod = setLocationMethod;
  }

  private static void ensureCorrectSignature(ExecutableElement setLocationMethod) {
    if (!setLocationMethod.getSimpleName().toString().equals("setLocation")) {
      throw new IllegalArgumentException(
          "setLocation method must be named setLocation, but was: " + setLocationMethod);
    }
    if (setLocationMethod.getParameters().size() != 1) {
      throw new IllegalArgumentException(
          "setLocation method must have exactly one parameter, but had: "
              + setLocationMethod.getParameters());
    }
  }

  public String generateMethodCode() {
    var code =
        """
        @Override
        public $retType setLocation(Option<IdentifiedLocation> location) {
          IdentifiedLocation loc = null;
          if (location.isDefined()) {
            loc = location.get();
          }
          return builder().location(loc).build();
        }
        """
            .replace("$retType", retType());
    return Utils.indent(code, 2);
  }

  private String retType() {
    return processingEnv
        .getTypeUtils()
        .asElement(setLocationMethod.getReturnType())
        .getSimpleName()
        .toString();
  }
}
