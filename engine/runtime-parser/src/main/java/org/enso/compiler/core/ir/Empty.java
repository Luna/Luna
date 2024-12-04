package org.enso.compiler.core.ir;

import java.util.UUID;
import org.enso.compiler.core.IR;
import org.enso.runtime.parser.dsl.IRCopyMethod;
import org.enso.runtime.parser.dsl.IRNode;

@IRNode
public interface Empty extends IR {
  static Empty createEmpty() {
    return EmptyGen.builder().build();
  }

  static Empty createFromLocation(IdentifiedLocation location) {
    return EmptyGen.builder().location(location).build();
  }

  static Empty createFromLocationAndPassData(IdentifiedLocation location, MetadataStorage passData) {
    return EmptyGen.builder()
        .location(location)
        .passData(passData)
        .build();
  }

  @IRCopyMethod
  Empty copy(IdentifiedLocation location, MetadataStorage passData, DiagnosticStorage diagnostics, UUID id);
}
