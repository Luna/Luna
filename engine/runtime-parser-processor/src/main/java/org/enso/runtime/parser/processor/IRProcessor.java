package org.enso.runtime.parser.processor;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.Set;
import java.util.stream.Collectors;
import javax.annotation.processing.AbstractProcessor;
import javax.annotation.processing.RoundEnvironment;
import javax.annotation.processing.SupportedAnnotationTypes;
import javax.lang.model.SourceVersion;
import javax.lang.model.element.Element;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;
import javax.tools.JavaFileObject;
import org.enso.runtime.parser.dsl.GenerateFields;
import org.enso.runtime.parser.dsl.GenerateIR;
import org.enso.runtime.parser.processor.utils.Utils;

@SupportedAnnotationTypes({
  "org.enso.runtime.parser.dsl.GenerateIR",
  "org.enso.runtime.parser.dsl.IRChild",
  "org.enso.runtime.parser.dsl.IRCopyMethod",
})
public class IRProcessor extends AbstractProcessor {

  @Override
  public SourceVersion getSupportedSourceVersion() {
    return SourceVersion.latest();
  }

  @Override
  public boolean process(Set<? extends TypeElement> annotations, RoundEnvironment roundEnv) {
    var generateIRElems = roundEnv.getElementsAnnotatedWith(GenerateIR.class);
    for (var generateIRElem : generateIRElems) {
      if (!ensureIsClass(generateIRElem)) {
        return false;
      }
      var suc = processGenerateIRElem((TypeElement) generateIRElem);
      if (!suc) {
        return false;
      }
    }
    return true;
  }

  /**
   * @param processedClassElem Class annotated with {@link GenerateIR}.
   * @return true if processing was successful, false otherwise.
   */
  private boolean processGenerateIRElem(TypeElement processedClassElem) {
    if (!ensureIsPublicFinal(processedClassElem)) {
      return false;
    }
    if (!ensureEnclosedInInterfaceOrPackage(processedClassElem)) {
      return false;
    }
    if (!ensureHasSingleAnnotatedConstructor(processedClassElem)) {
      return false;
    }
    var processedClass = constructProcessedClass(processedClassElem);
    if (processedClass == null) {
      printError("Failed to construct ProcessedClass", processedClassElem);
      return false;
    }

    var processedClassName = processedClassElem.getSimpleName().toString();
    var pkgName = packageName(processedClassElem);
    var newClassName = processedClassName + "Gen";
    String newBinaryName;
    if (!pkgName.isEmpty()) {
      newBinaryName = pkgName + "." + newClassName;
    } else {
      newBinaryName = newClassName;
    }

    JavaFileObject srcGen = null;
    try {
      srcGen = processingEnv.getFiler().createSourceFile(newBinaryName, processedClassElem);
    } catch (IOException e) {
      printError("Failed to create source file for IRNode", processedClassElem);
    }
    assert srcGen != null;

    String generatedCode;
    var classGenerator = new IRNodeClassGenerator(processingEnv, processedClass, newClassName);
    generatedCode = generateSingleNodeClass(classGenerator, processedClass, pkgName);

    try {
      try (var lineWriter = new PrintWriter(srcGen.openWriter())) {
        lineWriter.write(generatedCode);
      }
    } catch (IOException e) {
      printError("Failed to write to source file for IRNode", processedClassElem);
      return false;
    }
    return true;
  }

  private TypeElement findInterface(TypeElement processedClassElem, String interfaceName) {
    if (isBinaryName(interfaceName)) {
      var iface = processingEnv.getElementUtils().getTypeElement(interfaceName);
      return iface;
    } else {
      var enclosingElem = processedClassElem.getEnclosingElement();
      if (enclosingElem.getKind() == ElementKind.INTERFACE) {
        if (enclosingElem.getSimpleName().toString().equals(interfaceName)) {
          return (TypeElement) enclosingElem;
        }
      } else if (enclosingElem.getKind() == ElementKind.PACKAGE) {
        return (TypeElement)
            enclosingElem.getEnclosedElements().stream()
                .filter(pkgElem -> pkgElem.getKind() == ElementKind.INTERFACE)
                .filter(ifaceElem -> ifaceElem.getSimpleName().toString().equals(interfaceName))
                .findFirst()
                .orElse(null);
      }
    }
    return null;
  }

  private static boolean isBinaryName(String name) {
    return name.contains(".");
  }

  private ProcessedClass constructProcessedClass(TypeElement processedClassElem) {
    var generateIrAnnot = processedClassElem.getAnnotation(GenerateIR.class);
    var ifaceToImplement = findInterface(processedClassElem, generateIrAnnot.interfaces());
    if (ifaceToImplement == null) {
      printError(
          "Could not find interface '" + generateIrAnnot.interfaces() + "'", processedClassElem);
      return null;
    }
    if (!Utils.isSubtypeOfIR(ifaceToImplement, processingEnv)) {
      printError("Interface to implement must be a subtype of IR interface", ifaceToImplement);
      return null;
    }
    var annotatedCtor = getAnnotatedCtor(processedClassElem);
    var processedClass = new ProcessedClass(processedClassElem, annotatedCtor, ifaceToImplement);
    return processedClass;
  }

  private boolean ensureIsClass(Element elem) {
    if (elem.getKind() != ElementKind.CLASS) {
      printError("GenerateIR annotation can only be applied to classes", elem);
      return false;
    }
    return true;
  }

  private boolean ensureIsPublicFinal(TypeElement clazz) {
    if (!clazz.getModifiers().contains(Modifier.FINAL)
        || !clazz.getModifiers().contains(Modifier.PUBLIC)) {
      printError("Class annotated with @GenerateIR must be public final", clazz);
      return false;
    }
    return true;
  }

  private boolean ensureEnclosedInInterfaceOrPackage(TypeElement clazz) {
    var enclosingElem = clazz.getEnclosingElement();
    if (enclosingElem != null) {
      if (!(enclosingElem.getKind() == ElementKind.PACKAGE
          || enclosingElem.getKind() == ElementKind.INTERFACE)) {
        printError(
            "Class annotated with @GenerateIR must be enclosed in a package or an interface",
            clazz);
        return false;
      }
    }
    return true;
  }

  private boolean ensureHasSingleAnnotatedConstructor(TypeElement clazz) {
    var annotatedCtorsCnt =
        clazz.getEnclosedElements().stream()
            .filter(elem -> elem.getKind() == ElementKind.CONSTRUCTOR)
            .filter(ctor -> ctor.getAnnotation(GenerateFields.class) != null)
            .count();
    if (annotatedCtorsCnt != 1) {
      printError(
          "Class annotated with @GenerateIR must have exactly one constructor annotated with"
              + " @GenerateFields",
          clazz);
      return false;
    }
    return true;
  }

  private static ExecutableElement getAnnotatedCtor(TypeElement clazz) {
    // It should already be ensured that there is only a single annotated constructor in the class,
    // hence the AssertionError
    return clazz.getEnclosedElements().stream()
        .filter(elem -> elem.getAnnotation(GenerateFields.class) != null)
        .map(elem -> (ExecutableElement) elem)
        .findFirst()
        .orElseThrow(() -> new AssertionError("No constructor annotated with GenerateFields"));
  }

  private String packageName(Element elem) {
    var pkg = processingEnv.getElementUtils().getPackageOf(elem);
    return pkg.getQualifiedName().toString();
  }

  private void printError(String msg, Element elem) {
    Utils.printError(msg, elem, processingEnv.getMessager());
  }

  /**
   * Generates code for a super class.
   *
   * @param pkgName Package of the current processed class.
   * @return The generated code ready to be written to a {@code .java} source.
   */
  private static String generateSingleNodeClass(
      IRNodeClassGenerator irNodeClassGen, ProcessedClass processedClass, String pkgName) {
    var imports =
        irNodeClassGen.imports().stream().collect(Collectors.joining(System.lineSeparator()));
    var pkg = pkgName.isEmpty() ? "" : "package " + pkgName + ";";
    var interfaces = processedClass.getInterfaceElem().getQualifiedName().toString();
    var code =
        """
        $pkg

        $imports

        $docs
        abstract class $className implements $interfaces {
          $classBody
        }
        """
            .replace("$pkg", pkg)
            .replace("$imports", imports)
            .replace("$docs", jdoc(processedClass))
            .replace("$className", irNodeClassGen.getClassName())
            .replace("$interfaces", interfaces)
            .replace("$classBody", irNodeClassGen.classBody());
    return code;
  }

  private static String jdoc(ProcessedClass processedClass) {
    var thisClassName = IRProcessor.class.getName();
    var processedClassName = processedClass.getClazz().getQualifiedName().toString();
    var docs =
        """
        /**
         * Generated by {@code $thisClassName} IR annotation processor.
         * Generated from {@link $processedClassName}.
         * The {@link $processedClassName} is meant to extend this generated class.
         */
        """
            .replace("$thisClassName", thisClassName)
            .replace("$processedClassName", processedClassName);
    return docs;
  }
}
