package org.enso.compiler.pass.analyse.types.scope;

import java.util.List;
import org.enso.compiler.common.MethodResolutionAlgorithm;
import org.enso.compiler.pass.analyse.types.TypeRepresentation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** The implementation of {@link MethodResolutionAlgorithm} for static analysis. */
public final class StaticMethodResolution
    extends MethodResolutionAlgorithm<
        TypeRepresentation, TypeScopeReference, StaticImportExportScope, StaticModuleScope> {
  private final ModuleResolver moduleResolver;
  private final BuiltinsFallbackScope builtinsFallbackScope;
  private final Logger logger = LoggerFactory.getLogger(this.getClass());

  public StaticMethodResolution(
      ModuleResolver moduleResolver, BuiltinsFallbackScope builtinsFallbackScope) {
    this.moduleResolver = moduleResolver;
    this.builtinsFallbackScope = builtinsFallbackScope;
  }

  @Override
  protected StaticModuleScope findDefinitionScope(TypeScopeReference typeScopeReference) {
    var definitionModule = moduleResolver.findContainingModule(typeScopeReference);
    if (definitionModule != null) {
      return StaticModuleScope.forIR(definitionModule);
    } else {
      if (typeScopeReference.equals(TypeScopeReference.ANY)) {
        // We have special handling for ANY: it points to Standard.Base.Any.Any, but that may not
        // always be imported.
        // The runtime falls back to Standard.Builtins.Main, but that modules does not contain any
        // type information, so it is not useful for us.
        // Instead we fall back to the hardcoded definitions of the 5 builtins of Any.
        return builtinsFallbackScope.fallbackAnyScope();
      } else {
        logger.error("Could not find declaration module of type: {}", typeScopeReference);
        return null;
      }
    }
  }

  @Override
  protected TypeRepresentation getMethodForTypeFromScope(
      StaticImportExportScope scope, TypeScopeReference typeScopeReference, String methodName) {
    return scope.materialize(moduleResolver, this).getMethodForType(typeScopeReference, methodName);
  }

  @Override
  protected TypeRepresentation getExportedMethodFromScope(
      StaticImportExportScope scope, TypeScopeReference typeScopeReference, String methodName) {
    return scope
        .materialize(moduleResolver, this)
        .getExportedMethod(typeScopeReference, methodName);
  }

  @Override
  protected TypeRepresentation getConversionFromScope(
      StaticImportExportScope scope, TypeScopeReference target, TypeScopeReference source) {
    // TODO conversions in static analysis
    return null;
  }

  @Override
  protected TypeRepresentation getExportedConversionFromScope(
      StaticImportExportScope scope, TypeScopeReference target, TypeScopeReference source) {
    // TODO conversions in static analysis
    return null;
  }

  @Override
  protected TypeRepresentation onMultipleDefinitionsFromImports(
      String methodName,
      List<MethodFromImport<TypeRepresentation, StaticImportExportScope>> methodFromImports) {
    if (logger.isDebugEnabled()) {
      var foundImportNames = methodFromImports.stream().map(MethodFromImport::origin);
      logger.debug("Method {} is coming from multiple imports: {}", methodName, foundImportNames);
    }

    long foundTypesCount =
        methodFromImports.stream().map(MethodFromImport::resolutionResult).distinct().count();
    if (foundTypesCount > 1) {
      List<String> foundTypesWithOrigins =
          methodFromImports.stream()
              .distinct()
              .map(m -> m.resolutionResult() + " from " + m.origin())
              .toList();
      logger.error(
          "Method {} is coming from multiple imports with different types: {}",
          methodName,
          foundTypesWithOrigins);
      return null;
    } else {
      // If all types are the same, just return the first one
      return methodFromImports.get(0).resolutionResult();
    }
  }
}
