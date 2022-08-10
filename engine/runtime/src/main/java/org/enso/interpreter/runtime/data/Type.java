package org.enso.interpreter.runtime.data;

import com.oracle.truffle.api.CompilerAsserts;
import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.RootCallTarget;
import com.oracle.truffle.api.Truffle;
import com.oracle.truffle.api.dsl.Cached;
import com.oracle.truffle.api.dsl.Specialization;
import com.oracle.truffle.api.interop.InteropLibrary;
import com.oracle.truffle.api.interop.TruffleObject;
import com.oracle.truffle.api.library.ExportLibrary;
import com.oracle.truffle.api.library.ExportMessage;
import org.enso.interpreter.node.expression.atom.ConstantNode;
import org.enso.interpreter.node.expression.atom.GetFieldNode;
import org.enso.interpreter.runtime.Context;
import org.enso.interpreter.runtime.callable.UnresolvedConversion;
import org.enso.interpreter.runtime.callable.UnresolvedSymbol;
import org.enso.interpreter.runtime.callable.argument.ArgumentDefinition;
import org.enso.interpreter.runtime.callable.atom.AtomConstructor;
import org.enso.interpreter.runtime.callable.function.Function;
import org.enso.interpreter.runtime.callable.function.FunctionSchema;
import org.enso.interpreter.runtime.library.dispatch.TypesLibrary;
import org.enso.interpreter.runtime.scope.ModuleScope;
import org.enso.pkg.QualifiedName;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

@ExportLibrary(TypesLibrary.class)
@ExportLibrary(InteropLibrary.class)
public class Type implements TruffleObject {
  private final String name;
  private @CompilerDirectives.CompilationFinal ModuleScope definitionScope;
  private final boolean builtin;
  private final Type supertype;
  private boolean gettersGenerated;

  public Type(String name, ModuleScope definitionScope, Type supertype, boolean builtin) {
    this.name = name;
    this.definitionScope = definitionScope;
    this.supertype = supertype;
    this.builtin = builtin;
    generateQualifiedAccessor();
  }

  private void generateQualifiedAccessor() {
    var node = new ConstantNode(null, this);
    var callTarget = Truffle.getRuntime().createCallTarget(node);
    var function =
        new Function(
            callTarget,
            null,
            new FunctionSchema(
                new ArgumentDefinition(0, "this", ArgumentDefinition.ExecutionMode.EXECUTE)));
    definitionScope.registerMethod(definitionScope.getAssociatedType(), this.name, function);
  }

  public QualifiedName getQualifiedName() {
    if (this == this.getDefinitionScope().getAssociatedType()) {
      return definitionScope.getModule().getName();
    } else {
      return definitionScope.getModule().getName().createChild(getName());
    }
  }

  public void setShadowDefinitions(ModuleScope scope) {
    if (builtin) {
      // Ensure that synthetic methods, such as getters for fields are in the scope
      // Some scopes won't have any methods at this point, e.g., Nil or Nothing, hence the null
      // check.
      CompilerAsserts.neverPartOfCompilation();
      Map<String, Function> methods = this.definitionScope.getMethods().get(this);
      if (methods != null) {
        methods.forEach((name, fun) -> scope.registerMethod(this, name, fun));
      }
      this.definitionScope = scope;
    } else {
      throw new RuntimeException(
          "Attempting to modify scope of a non-builtin type post-construction is not allowed");
    }
  }

  public String getName() {
    return name;
  }

  public ModuleScope getDefinitionScope() {
    return definitionScope;
  }

  public boolean isBuiltin() {
    return builtin;
  }

  public Type getSupertype() {
    return supertype;
  }

  public void generateGetters(List<AtomConstructor> constructors) {
    if (gettersGenerated) return;
    gettersGenerated = true;
    if (constructors.size() != 1) return; // TODO
    var cons = constructors.get(0);
    Arrays.stream(cons.getFields())
        .forEach(
            field -> {
              GetFieldNode node = new GetFieldNode(null, field.getPosition());
              RootCallTarget callTarget = Truffle.getRuntime().createCallTarget(node);
              var f =
                  new Function(
                      callTarget,
                      null,
                      new FunctionSchema(
                          new ArgumentDefinition(
                              0, "this", ArgumentDefinition.ExecutionMode.EXECUTE)));
              definitionScope.registerMethod(this, field.getName(), f);
            });
  }

  @ExportMessage
  boolean hasType() {
    return true;
  }

  @ExportMessage
  Type getType() {
    // TODO[MK] make this the eigentype when implementing statics
    return this;
  }

  @ExportMessage
  String toDisplayString(boolean allowSideEffects) {
    return name;
  }

  @Override
  public String toString() {
    return toDisplayString(true);
  }
}
