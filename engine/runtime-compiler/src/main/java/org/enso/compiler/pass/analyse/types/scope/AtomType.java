package org.enso.compiler.pass.analyse.types.scope;

import org.enso.compiler.pass.analyse.types.TypeRepresentation;

import java.util.List;

public final class AtomType {
  private final String name;
  private final List<Constructor> constructors;

  public AtomType(String name, List<Constructor> constructors) {
    this.name = name;
    this.constructors = constructors;
  }

  public String getName() {
    return name;
  }

  public Constructor getConstructor(String name) {
    return constructors.stream().filter(c -> c.name().equals(name)).findFirst().orElse(null);
  }

  /**
   * Represents a constructor of the atom type.
   *
   * @param name the name of the constructor
   * @param isProjectPrivate whether the constructor is project private
   * @param type the type ascribed to the constructor, it may be null if it is unknown
   *              TODO the type will soon be always non-null - once we can handle default arguments
   */
  public record Constructor(String name, boolean isProjectPrivate, TypeRepresentation type) {}
}
