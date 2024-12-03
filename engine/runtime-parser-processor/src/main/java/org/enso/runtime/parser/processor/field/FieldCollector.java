package org.enso.runtime.parser.processor.field;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.annotation.processing.ProcessingEnvironment;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.TypeElement;
import javax.lang.model.type.DeclaredType;
import javax.lang.model.type.TypeMirror;
import org.enso.runtime.parser.dsl.IRChild;
import org.enso.runtime.parser.processor.utils.Utils;

/**
 * Collects abstract parameterless methods from the given interface and all its superinterfaces -
 * these will be represented as fields in the generated classes, hence the name.
 */
public final class FieldCollector {
  private final ProcessingEnvironment processingEnv;
  private final TypeElement irNodeInterface;
  // Mapped by field name
  private final Map<String, Field> fields = new LinkedHashMap<>();

  /**
   * @param irNodeInterface For this interface, fields will be collected.
   */
  public FieldCollector(ProcessingEnvironment processingEnv, TypeElement irNodeInterface) {
    assert irNodeInterface.getKind() == ElementKind.INTERFACE;
    this.processingEnv = processingEnv;
    this.irNodeInterface = irNodeInterface;
  }

  public List<Field> collectFields() {
    var superInterfaces = irNodeInterface.getInterfaces();
    Deque<TypeMirror> toProcess = new ArrayDeque<>();
    toProcess.add(irNodeInterface.asType());
    toProcess.addAll(superInterfaces);
    // Process transitively all the super interface until the parent IR is reached.
    while (!toProcess.isEmpty()) {
      var current = toProcess.pop();
      // Skip processing of IR root interface.
      if (Utils.isIRInterface(current, processingEnv)) {
        continue;
      }
      var currentElem = processingEnv.getTypeUtils().asElement(current);
      if (currentElem instanceof TypeElement currentTypeElem) {
        collectFromSingleInterface(currentTypeElem);
        // Add all super interfaces to the processing queue, if they are not there already.
        for (var superInterface : currentTypeElem.getInterfaces()) {
          if (!toProcess.contains(superInterface)) {
            toProcess.add(superInterface);
          }
        }
      }
    }
    return fields.values().stream().toList();
  }

  /** Collect only parameterless methods without default implementation. */
  private void collectFromSingleInterface(TypeElement typeElem) {
    assert typeElem.getKind() == ElementKind.INTERFACE;
    for (var childElem : typeElem.getEnclosedElements()) {
      if (childElem instanceof ExecutableElement methodElement) {
        if (methodElement.getParameters().isEmpty()
            && !Utils.hasImplementation(methodElement, irNodeInterface, processingEnv)) {
          var name = methodElement.getSimpleName().toString();
          if (!fields.containsKey(name)) {
            var field = methodToField(methodElement);
            fields.put(name, field);
          }
        }
      }
    }
  }

  private Field methodToField(ExecutableElement methodElement) {
    var name = methodElement.getSimpleName().toString();
    var retType = methodElement.getReturnType();
    if (retType.getKind().isPrimitive()) {
      return new PrimitiveField(retType, name);
    }

    var retTypeElem = (TypeElement) processingEnv.getTypeUtils().asElement(retType);
    assert retTypeElem != null;
    var childAnnot = methodElement.getAnnotation(IRChild.class);
    if (childAnnot == null) {
      return new ReferenceField(processingEnv, retTypeElem, name, false, false);
    }

    assert childAnnot != null;
    if (Utils.isScalaList(retTypeElem, processingEnv)) {
      assert retType instanceof DeclaredType;
      var declaredRetType = (DeclaredType) retType;
      assert declaredRetType.getTypeArguments().size() == 1;
      var typeArg = declaredRetType.getTypeArguments().get(0);
      var typeArgElem = (TypeElement) processingEnv.getTypeUtils().asElement(typeArg);
      ensureIsSubtypeOfIR(typeArgElem);
      return new ListField(name, retTypeElem, typeArgElem);
    }

    boolean isNullable = !childAnnot.required();
    ensureIsSubtypeOfIR(retTypeElem);
    return new ReferenceField(processingEnv, retTypeElem, name, isNullable, true);
  }

  private void ensureIsSubtypeOfIR(TypeElement typeElem) {
    if (!Utils.isSubtypeOfIR(typeElem, processingEnv)) {
      Utils.printError(
          "Method annotated with @IRChild must return a subtype of IR interface",
          typeElem,
          processingEnv.getMessager());
    }
  }
}
