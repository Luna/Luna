package org.enso.compiler.common;

import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;

/**
 * Encapsulates the logic for resolving a method call on a type/module.
 *
 * <p>The same logic is needed in two places:
 *
 * <ol>
 *   <li>in the runtime ({@link
 *       org.enso.interpreter.runtime.scope.ModuleScope#lookupMethodDefinition}),
 *   <li>in the type checker ({@link org.enso.compiler.pass.analyse.types.MethodTypeResolver}).
 * </ol>
 *
 * <p>To ensure that all usages stay consistent, they should all rely on the logic implemented in
 * this class, customizing it to the specific needs of the context in which it is used.
 *
 * @param <ModuleScopeType> the type of the module scope that the algorithm will be working with
 * @see CommonModuleScopeShape for the explanation of other type parameters
 */
public abstract class MethodResolutionAlgorithm<
    FunctionType,
    TypeScopeReferenceType,
    ImportExportScopeType,
    ModuleScopeType extends
        CommonModuleScopeShape<FunctionType, TypeScopeReferenceType, ImportExportScopeType>> {

  /**
   * Looks up a method definition as seen in the current module.
   *
   * <p>This takes into consideration all definitions local to the module and everything that has
   * been imported.
   *
   * <p>The algorithm is as follows:
   *
   * <ol>
   *   <li>Methods defined in the same module as the type which is being called have the highest
   *       precedence.
   *   <li>Next, methods defined in the current module are considered.
   *   <li>Finally, methods imported from other modules.
   * </ol>
   */
  public FunctionType lookupMethodDefinition(
      ModuleScopeType currentModuleScope, TypeScopeReferenceType type, String methodName) {
    var definitionScope = findDefinitionScope(type);
    if (definitionScope != null) {
      var definedWithAtom = definitionScope.getMethodForType(type, methodName);
      if (definedWithAtom != null) {
        return definedWithAtom;
      }
    }

    var definedHere = currentModuleScope.getMethodForType(type, methodName);
    if (definedHere != null) {
      return definedHere;
    }

    return findInImports(currentModuleScope, type, methodName);
  }

  /**
   * Finds a method exported by a module.
   *
   * <p>It first checks methods defined in the module and later checks any methods re-exported from
   * other modules.
   */
  public FunctionType getExportedMethod(
      ModuleScopeType moduleScope, TypeScopeReferenceType type, String methodName) {
    var definedLocally = moduleScope.getMethodForType(type, methodName);
    if (definedLocally != null) {
      return definedLocally;
    }

    return moduleScope.getExports().stream()
        .map(scope -> getMethodForTypeFromScope(scope, type, methodName))
        .filter(Objects::nonNull)
        .findFirst()
        .orElse(null);
  }

  /**
   * Looks up a conversion definition as seen in the current module.
   *
   * <p>The algorithm is as follows:
   *
   * <ol>
   *   <li>Conversions defined in the definition module of the source type are looked-up first,
   *   <li>Next, conversions defined in the definition module of the target type are considered,
   *   <li>Then, conversions defined in the current module are considered,
   *   <li>Finally, conversions imported from other modules are considered.
   * </ol>
   */
  public FunctionType lookupConversionDefinition(
      ModuleScopeType currentModuleScope,
      TypeScopeReferenceType source,
      TypeScopeReferenceType target) {
    var definedWithSource = findDefinitionScope(source).getConversionFor(target, source);
    if (definedWithSource != null) {
      return definedWithSource;
    }

    var definedWithTarget = findDefinitionScope(target).getConversionFor(target, source);
    if (definedWithTarget != null) {
      return definedWithTarget;
    }

    var definedHere = currentModuleScope.getConversionFor(target, source);
    if (definedHere != null) {
      return definedHere;
    }

    return currentModuleScope.getImports().stream()
        .map(scope -> getExportedConversionFromScope(scope, target, source))
        .filter(Objects::nonNull)
        .findFirst()
        .orElse(null);
  }

  /**
   * Finds a conversion exported by a module.
   *
   * <p>It first checks conversions defined in the module and later checks any conversions
   * re-exported from other modules.
   */
  public FunctionType getExportedConversion(
      ModuleScopeType moduleScope, TypeScopeReferenceType target, TypeScopeReferenceType source) {
    var definedLocally = moduleScope.getConversionFor(target, source);
    if (definedLocally != null) {
      return definedLocally;
    }

    return moduleScope.getExports().stream()
        .map(scope -> getConversionFromScope(scope, target, source))
        .filter(Objects::nonNull)
        .findFirst()
        .orElse(null);
  }

  private FunctionType findInImports(
      ModuleScopeType currentModuleScope, TypeScopeReferenceType type, String methodName) {
    var found =
        currentModuleScope.getImports().stream()
            .flatMap(
                (importExportScope) -> {
                  var exportedMethod =
                      getExportedMethodFromScope(importExportScope, type, methodName);
                  if (exportedMethod != null) {
                    return Stream.of(new MethodFromImport<>(exportedMethod, importExportScope));
                  } else {
                    return Stream.empty();
                  }
                })
            .toList();

    if (found.size() == 1) {
      return found.get(0).resolutionResult;
    } else if (found.size() > 1) {
      return onMultipleDefinitionsFromImports(methodName, found);
    } else {
      return null;
    }
  }

  /** Locates the module scope in which the provided type was defined. */
  protected abstract ModuleScopeType findDefinitionScope(TypeScopeReferenceType type);

  /**
   * Implementation detail that should delegate to a {@code getMethodReference} variant in the given
   * scope.
   */
  protected abstract FunctionType getMethodForTypeFromScope(
      ImportExportScopeType scope, TypeScopeReferenceType type, String methodName);

  /**
   * Implementation detail that should delegate to a {@code getExportedMethod} variant in the given
   * scope.
   */
  protected abstract FunctionType getExportedMethodFromScope(
      ImportExportScopeType scope, TypeScopeReferenceType type, String methodName);

  /**
   * Implementation detail that should delegate to a {@code getConversionForType} variant in the
   * given scope.
   */
  protected abstract FunctionType getConversionFromScope(
      ImportExportScopeType scope, TypeScopeReferenceType target, TypeScopeReferenceType source);

  /**
   * Implementation detail that should delegate to a {@code getExportedConversion} variant in the
   * given scope.
   */
  protected abstract FunctionType getExportedConversionFromScope(
      ImportExportScopeType scope, TypeScopeReferenceType target, TypeScopeReferenceType source);

  /**
   * Defines the behaviour when a method resolving to distinct results is found in multiple imports.
   */
  protected abstract FunctionType onMultipleDefinitionsFromImports(
      String methodName, List<MethodFromImport<FunctionType, ImportExportScopeType>> imports);

  /**
   * Represents a method found in an import scope.
   *
   * @param resolutionResult the result of the resolution
   * @param origin the scope in which it was found
   */
  protected record MethodFromImport<FunctionType, ImportExportScopeType>(
      FunctionType resolutionResult, ImportExportScopeType origin) {}
}
