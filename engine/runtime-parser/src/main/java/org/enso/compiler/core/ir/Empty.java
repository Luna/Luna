package org.enso.compiler.core.ir;

import org.enso.runtime.parser.dsl.GenerateFields;
import org.enso.runtime.parser.dsl.GenerateIR;

@GenerateIR(interfaces = "org.enso.compiler.core.ir.Expression")
public final class Empty extends EmptyGen {
  @GenerateFields
  public Empty(IdentifiedLocation identifiedLocation, MetadataStorage passData) {
    super(null, passData, identifiedLocation, null);
  }

  public Empty(IdentifiedLocation identifiedLocation) {
    this(identifiedLocation, null);
  }
}
