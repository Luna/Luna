package org.enso.runtime.parser.processor.test.gen.ir;

import org.enso.compiler.core.IR;
import org.enso.runtime.parser.dsl.IRChild;
import org.enso.runtime.parser.dsl.IRNode;
import org.enso.runtime.parser.processor.test.gen.ir.module.scope.JExport;
import org.enso.runtime.parser.processor.test.gen.ir.module.scope.JImport;
import scala.collection.immutable.List;

@IRNode
public interface JModule extends IR {
  @IRChild
  List<JImport> imports();

  @IRChild
  List<JExport> exports();
}
