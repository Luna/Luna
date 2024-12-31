package org.enso.compiler.pass.analyse.types;

import java.util.List;
import org.enso.compiler.core.ir.Expression;
import org.enso.compiler.data.BindingsMap;
import org.enso.compiler.pass.analyse.types.util.ProxyList;
import scala.jdk.javaapi.CollectionConverters$;

/** Implementation of {@link AtomTypeInterface} that is built from a {@link BindingsMap.Type}. */
@Deprecated
public final class AtomTypeInterfaceFromBindingsMap implements AtomTypeInterface {
  // TODO this probably is no longer needed since we have StaticModuleScope
  private final BindingsMap.Type type;

  public AtomTypeInterfaceFromBindingsMap(BindingsMap.Type type) {
    this.type = type;
  }

  // Needed for Persistable
  public BindingsMap.Type type() {
    return type;
  }

  @Override
  public List<? extends Constructor> constructors() {
    return new ProxyList<>(
        CollectionConverters$.MODULE$.asJava(type.members()), ConstructorFromBindingsMap::new);
  }

  static class ConstructorFromBindingsMap implements Constructor {
    private final BindingsMap.Cons constructor;

    ConstructorFromBindingsMap(BindingsMap.Cons constructor) {
      this.constructor = constructor;
    }

    @Override
    public String name() {
      return constructor.name();
    }

    @Override
    public List<? extends Argument> arguments() {
      return new ProxyList<>(
          CollectionConverters$.MODULE$.asJava(constructor.arguments()),
          ArgumentFromBindingsMap::new);
    }
  }

  private static class ArgumentFromBindingsMap implements Argument {
    private final BindingsMap.Argument arg;

    public ArgumentFromBindingsMap(BindingsMap.Argument arg) {
      this.arg = arg;
    }

    @Override
    public String name() {
      return arg.name();
    }

    @Override
    public boolean hasDefaultValue() {
      return arg.hasDefaultValue();
    }

    @Deprecated
    @Override
    public TypeRepresentation getType(TypeResolver resolver) {
      throw new IllegalStateException("No longer supported - this class will be removed soon.");
    }
  }
}
