package org.enso.compiler.codegen

import org.enso.interpreter.runtime.Module
import org.enso.compiler.pass.analyse.BindingResolution
import org.enso.interpreter.runtime.callable.atom.AtomConstructor

class TruffleStubsGenerator() {
  def run(module: Module): Unit = {
    val ir = module.getIr
    val scope = module.getScope
    val localBindings = ir.unsafeGetMetadata(BindingResolution, "Non-parsed module used in stubs generator")
    localBindings.types.foreach { tp =>
      val constructor = new AtomConstructor(tp.name.name, scope)
      scope.registerConstructor(constructor)
    }
  }
}
