package org.enso.runtime.parser.processor.field;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.annotation.processing.ProcessingEnvironment;
import javax.lang.model.element.TypeElement;
import javax.lang.model.element.VariableElement;
import javax.lang.model.type.DeclaredType;
import org.enso.runtime.parser.dsl.IRChild;
import org.enso.runtime.parser.dsl.IRField;
import org.enso.runtime.parser.processor.ProcessedClass;
import org.enso.runtime.parser.processor.utils.Utils;

/**
 * Collects abstract parameterless methods from the given interface and all its superinterfaces -
 * these will be represented as fields in the generated classes, hence the name.
 */
public final class FieldCollector {
  private final ProcessingEnvironment processingEnv;
  private final ProcessedClass processedClass;
  // Mapped by field name
  private Map<String, Field> fields;

  public FieldCollector(ProcessingEnvironment processingEnv, ProcessedClass processedClass) {
    this.processingEnv = processingEnv;
    this.processedClass = processedClass;
  }

  public List<Field> collectFields() {
    if (fields == null) {
      fields = new LinkedHashMap<>();
      collectFromCtor();
    }
    return fields.values().stream().toList();
  }

  private void collectFromCtor() {
    var ctor = processedClass.getCtor();
    for (var param : ctor.getParameters()) {
      var paramName = param.getSimpleName().toString();
      var irFieldAnnot = param.getAnnotation(IRField.class);
      var irChildAnnot = param.getAnnotation(IRChild.class);
      Field field;
      if (Utils.hasNoAnnotations(param)) {
        field = null;
      } else if (irFieldAnnot != null) {
        field = processIrField(param, irFieldAnnot);
      } else if (irChildAnnot != null) {
        field = processIrChild(param, irChildAnnot);
      } else {
        throw new IllegalStateException("Unexpected annotation on constructor parameter " + param);
      }

      if (field != null) {
        fields.put(paramName, field);
      }
    }
  }

  private Field processIrField(VariableElement param, IRField irFieldAnnot) {
    var isNullable = !irFieldAnnot.required();
    var name = param.getSimpleName().toString();
    var type = getParamType(param);
    if (isPrimitiveType(param)) {
      return new PrimitiveField(param.asType(), name);
    } else {
      // TODO: Assert that type is simple reference type - does not extend IR, is not generic
      Utils.hardAssert(type != null);
      return new ReferenceField(processingEnv, type, name, isNullable, false);
    }
  }

  private Field processIrChild(VariableElement param, IRChild irChildAnnot) {
    var name = param.getSimpleName().toString();
    var type = getParamType(param);
    var isNullable = !irChildAnnot.required();
    if (Utils.isScalaList(type, processingEnv)) {
      assert type instanceof DeclaredType;
      var declaredRetType = (DeclaredType) type;
      assert declaredRetType.getTypeArguments().size() == 1;
      var typeArg = declaredRetType.getTypeArguments().get(0);
      var typeArgElem = (TypeElement) processingEnv.getTypeUtils().asElement(typeArg);
      ensureIsSubtypeOfIR(typeArgElem);
      return new ListField(name, type, typeArgElem);
    } else {
      if (!Utils.isSubtypeOfIR(type, processingEnv)) {
        Utils.printError(
            "Constructor parameter annotated with @IRChild must be a subtype of IR interface",
            param,
            processingEnv.getMessager());
      }
      return new ReferenceField(processingEnv, type, name, isNullable, true);
    }
  }

  private static boolean isPrimitiveType(VariableElement ctorParam) {
    return ctorParam.asType().getKind().isPrimitive();
  }

  private TypeElement getParamType(VariableElement param) {
    return (TypeElement) processingEnv.getTypeUtils().asElement(param.asType());
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
