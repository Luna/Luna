package org.enso.runtime.parser.processor;

import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.TypeElement;
import org.enso.runtime.parser.dsl.GenerateIR;

/**
 * Represents a class annotated with {@link org.enso.runtime.parser.dsl.GenerateIR} that is
 * currently being processed by the {@link IRProcessor}.
 */
public final class ProcessedClass {
  private final TypeElement clazz;
  private final ExecutableElement ctor;
  private final TypeElement interfaceElem;

  /**
   * @param clazz Class being processed by the processor, annotated with {@link GenerateIR}
   * @param ctor Constructor annotated with {@link org.enso.runtime.parser.dsl.GenerateFields}.
   * @param interfaceElem Interface that the generated superclass must implement. See {@link
   *     GenerateIR#interfaces()}.
   */
  ProcessedClass(TypeElement clazz, ExecutableElement ctor, TypeElement interfaceElem) {
    this.clazz = clazz;
    this.ctor = ctor;
    this.interfaceElem = interfaceElem;
  }

  public TypeElement getClazz() {
    return clazz;
  }

  public ExecutableElement getCtor() {
    return ctor;
  }

  public TypeElement getInterfaceElem() {
    return interfaceElem;
  }
}
