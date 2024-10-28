package org.enso.compiler.pass.analyse.types.scope;

import org.enso.compiler.pass.analyse.types.TypeRepresentation;

import java.util.List;

public final class AtomType {
  private final String name;

  public AtomType(String name, List<Constructor> constructors) {
    this.name = name;
  }

  public String getName() {
    return name;
  }

  // TODO mark type in constructor only if no default arguments, treat same as function?
  // TODO this should replace AtomTypeInterface

  /**
   * Represents a constructor of the atom type.
   *
   * @param name the name of the constructor
   * @param isProjectPrivate whether the constructor is project private
   * @param type the type ascribed to the constructor, it may be null if it is unknown
   */
  public record Constructor(String name, boolean isProjectPrivate, TypeRepresentation type) {}
}
