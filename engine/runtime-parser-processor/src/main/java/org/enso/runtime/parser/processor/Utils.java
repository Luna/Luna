package org.enso.runtime.parser.processor;

import java.lang.annotation.Annotation;
import java.util.ArrayDeque;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import javax.annotation.processing.Messager;
import javax.annotation.processing.ProcessingEnvironment;
import javax.lang.model.element.Element;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;
import javax.lang.model.type.TypeMirror;
import javax.tools.Diagnostic.Kind;

public final class Utils {

  private static final String MAP_EXPRESSIONS = "mapExpressions";
  private static final String DUPLICATE = "duplicate";

  private Utils() {}

  /** Returns true if the given {@code type} is a subtype of {@code org.enso.compiler.core.IR}. */
  public static boolean isSubtypeOfIR(TypeElement type, ProcessingEnvironment processingEnv) {
    var irIfaceFound =
        iterateSuperInterfaces(
            type,
            processingEnv,
            (TypeElement iface) -> {
              // current.getQualifiedName().toString() returns only "IR" as well, so we can't use
              // it.
              // This is because runtime-parser-processor project does not depend on runtime-parser
              // and
              // so the org.enso.compiler.core.IR interface is not available in the classpath.
              if (iface.getSimpleName().toString().equals("IR")) {
                return true;
              }
              return null;
            });
    return irIfaceFound != null;
  }

  /** Returns true if the given {@code type} is an {@code org.enso.compiler.core.IR} interface. */
  public static boolean isIRInterface(TypeMirror type, ProcessingEnvironment processingEnv) {
    var elem = processingEnv.getTypeUtils().asElement(type);
    return elem.getKind() == ElementKind.INTERFACE && elem.getSimpleName().toString().equals("IR");
  }

  /** Returns true if the given type extends {@link org.enso.compiler.core.ir.Expression} */
  public static boolean isSubtypeOfExpression(
      TypeMirror type, ProcessingEnvironment processingEnv) {
    var expressionType =
        processingEnv
            .getElementUtils()
            .getTypeElement("org.enso.compiler.core.ir.Expression")
            .asType();
    return processingEnv.getTypeUtils().isAssignable(type, expressionType);
  }

  public static void printError(String msg, Element elem, Messager messager) {
    messager.printMessage(Kind.ERROR, msg, elem);
  }

  public static void printErrorAndFail(String msg, Element elem, Messager messager) {
    printError(msg, elem, messager);
    throw new IllegalStateException("Unexpected failure during annotation processing: " + msg);
  }

  static String indent(String code, int indentation) {
    return code.lines()
        .map(line -> " ".repeat(indentation) + line)
        .collect(Collectors.joining(System.lineSeparator()));
  }

  public static boolean isScalaList(TypeElement type, ProcessingEnvironment procEnv) {
    var scalaListType = procEnv.getElementUtils().getTypeElement("scala.collection.immutable.List");
    return procEnv.getTypeUtils().isAssignable(type.asType(), scalaListType.asType());
  }

  /**
   * Returns true if the method has an implementation (is default or static) in some of the super
   * interfaces.
   *
   * <p>If the method is implemented in some of the super interfaces, there must not be generated an
   * override for it - that would result in compilation error.
   *
   * @param method the method to check
   * @param interfaceType the interface that declares the method to check for the implementation.
   * @param procEnv
   * @return
   */
  public static boolean hasImplementation(
      ExecutableElement method, TypeElement interfaceType, ProcessingEnvironment procEnv) {
    var defImplFound =
        iterateSuperInterfaces(
            interfaceType,
            procEnv,
            (TypeElement superInterface) -> {
              for (var enclosedElem : superInterface.getEnclosedElements()) {
                if (enclosedElem instanceof ExecutableElement executableElem) {
                  if (executableElem.getSimpleName().equals(method.getSimpleName())) {
                    if (hasModifier(executableElem, Modifier.DEFAULT)
                        || hasModifier(executableElem, Modifier.STATIC)) {
                      return true;
                    }
                  }
                }
              }
              return null;
            });
    return defImplFound != null;
  }

  static boolean hasModifier(ExecutableElement method, Modifier modifier) {
    return method.getModifiers().contains(modifier);
  }

  /**
   * Finds a method in the interface hierarchy. The interface hierarchy processing starts from
   * {@code interfaceType} and iterates until {@code org.enso.compiler.core.IR} interface type is
   * encountered. Every method in the hierarchy is checked by {@code methodPredicate}.
   *
   * @param interfaceType Type of the interface. Must extend {@code org.enso.compiler.core.IR}.
   * @param procEnv
   * @param methodPredicate Predicate that is called for each method in the hierarchy.
   * @return Method that satisfies the predicate or null if no such method is found.
   */
  static ExecutableElement findMethod(
      TypeElement interfaceType,
      ProcessingEnvironment procEnv,
      Predicate<ExecutableElement> methodPredicate) {
    var foundMethod =
        iterateSuperInterfaces(
            interfaceType,
            procEnv,
            (TypeElement superInterface) -> {
              for (var enclosedElem : superInterface.getEnclosedElements()) {
                if (enclosedElem instanceof ExecutableElement execElem) {
                  if (methodPredicate.test(execElem)) {
                    return execElem;
                  }
                }
              }
              return null;
            });
    return foundMethod;
  }

  /**
   * Find any override of {@link org.enso.compiler.core.IR#duplicate(boolean, boolean, boolean,
   * boolean) duplicate method}. Or the duplicate method on the interface itself. Note that there
   * can be an override with a different return type in a sub interface.
   *
   * @param interfaceType Interface from where the search is started. All super interfaces are
   *     searched transitively.
   * @return not null.
   */
  static ExecutableElement findDuplicateMethod(
      TypeElement interfaceType, ProcessingEnvironment procEnv) {
    var duplicateMethod = findMethod(interfaceType, procEnv, Utils::isDuplicateMethod);
    hardAssert(
        duplicateMethod != null,
        "Interface "
            + interfaceType.getQualifiedName()
            + " must implement IR, so it must declare duplicate method");
    return duplicateMethod;
  }

  static ExecutableElement findMapExpressionsMethod(
      TypeElement interfaceType, ProcessingEnvironment processingEnv) {
    var mapExprsMethod =
        findMethod(
            interfaceType,
            processingEnv,
            method -> method.getSimpleName().toString().equals(MAP_EXPRESSIONS));
    hardAssert(
        mapExprsMethod != null,
        "mapExpressions method must be found it must be defined at least on IR super interface");
    return mapExprsMethod;
  }

  static void hardAssert(boolean condition) {
    hardAssert(condition, "Assertion failed");
  }

  static void hardAssert(boolean condition, String msg) {
    if (!condition) {
      throw new AssertionError(msg);
    }
  }

  static boolean hasAnnotation(Element element, Class<? extends Annotation> annotationClass) {
    return element.getAnnotation(annotationClass) != null;
  }

  private static boolean isDuplicateMethod(ExecutableElement executableElement) {
    return executableElement.getSimpleName().toString().equals(DUPLICATE)
        && executableElement.getParameters().size() == 4;
  }

  /**
   * @param type Type from which the iterations starts.
   * @param processingEnv
   * @param ifaceVisitor Visitor that is called for each interface.
   * @param <T>
   */
  static <T> T iterateSuperInterfaces(
      TypeElement type,
      ProcessingEnvironment processingEnv,
      InterfaceHierarchyVisitor<T> ifaceVisitor) {
    var interfacesToProcess = new ArrayDeque<TypeElement>();
    interfacesToProcess.add(type);
    while (!interfacesToProcess.isEmpty()) {
      var current = interfacesToProcess.pop();
      var iterationResult = ifaceVisitor.visitInterface(current);
      if (iterationResult != null) {
        return iterationResult;
      }
      // Add all super interfaces to the queue
      for (var superInterface : current.getInterfaces()) {
        var superInterfaceElem = processingEnv.getTypeUtils().asElement(superInterface);
        if (superInterfaceElem instanceof TypeElement superInterfaceTypeElem) {
          interfacesToProcess.add(superInterfaceTypeElem);
        }
      }
    }
    return null;
  }
}
