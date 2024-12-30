package org.enso.compiler.pass.analyse.types.scope;

import org.enso.compiler.pass.analyse.types.BuiltinTypes;
import org.enso.compiler.pass.analyse.types.TypeRepresentation;
import org.enso.pkg.QualifiedName;

/**
 * This is a special scope that notes methods which are always available on Any type.
 *
 * <p>They are available even without any imports.
 */
public class BuiltinsFallbackScope {
  private StaticModuleScope cachedAnyScope = null;

  public StaticModuleScope fallbackAnyScope() {
    if (cachedAnyScope != null) {
      return cachedAnyScope;
    }

    var scopeBuilder =
        new StaticModuleScope.Builder(QualifiedName.fromString("Standard.Builtins.Main"));
    scopeBuilder.registerMethod(TypeScopeReference.ANY, "to_text", BuiltinTypes.TEXT);
    scopeBuilder.registerMethod(TypeScopeReference.ANY, "to_display_text", BuiltinTypes.TEXT);
    scopeBuilder.registerMethod(TypeScopeReference.ANY, "pretty", BuiltinTypes.TEXT);

    var any = new TypeRepresentation.TopType();
    scopeBuilder.registerMethod(
        TypeScopeReference.ANY, "==", new TypeRepresentation.ArrowType(any, BuiltinTypes.BOOLEAN));

    var catchType =
        new TypeRepresentation.ArrowType(new TypeRepresentation.ArrowType(any, any), any);
    scopeBuilder.registerMethod(TypeScopeReference.ANY, "catch_primitive", catchType);

    cachedAnyScope = scopeBuilder.build();
    return cachedAnyScope;
  }
}
