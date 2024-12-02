package org.enso.runtime.parser.processor.test.gen.ir.core;

import java.util.UUID;
import org.enso.compiler.core.IR;
import org.enso.compiler.core.ir.DiagnosticStorage;
import org.enso.compiler.core.ir.IdentifiedLocation;
import org.enso.compiler.core.ir.MetadataStorage;
import org.enso.runtime.parser.dsl.IRCopyMethod;
import org.enso.runtime.parser.dsl.IRNode;

@IRNode
public interface JEmpty extends IR {
  static JEmptyGen.Builder builder() {
    return JEmptyGen.builder();
  }

  static JEmpty createEmpty() {
    return JEmptyGen.builder().build();
  }

  static JEmpty createFromLocation(IdentifiedLocation location) {
    return JEmptyGen.builder().location(location).build();
  }

  static JEmpty createFromLocationAndPassData(
      IdentifiedLocation location, MetadataStorage passData) {
    return JEmptyGen.builder().location(location).passData(passData).build();
  }

  @IRCopyMethod
  JEmpty copy(
      IdentifiedLocation location,
      MetadataStorage passData,
      DiagnosticStorage diagnostics,
      UUID id);
}
