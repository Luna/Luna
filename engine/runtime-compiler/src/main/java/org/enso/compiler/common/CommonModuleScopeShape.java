package org.enso.compiler.common;

import java.util.Collection;

/**
 * A common type for module scopes.
 *
 * <p>It encapsulates the common parts of the module scope that is shared between:
 *
 * <ul>
 *   <li>the ModuleScope in the runtime
 *   <li>the StaticModuleScope in the type checker
 * </ul>
 *
 * @param <FunctionType> the type to which methods are resolved - in the interpreter this will be a
 *     callable Function reference, in the type-checker this will be a type signature
 * @param <TypeScopeReferenceType> the type of type-scope references - they define an 'identity' of
 *     a type (atom type, its eigen type or module-associated type)
 * @param <ImportExportScopeType> the type of import/export scopes - helper types that tie
 *     import/export relations between modules
 */
public interface CommonModuleScopeShape<
    FunctionType, TypeScopeReferenceType, ImportExportScopeType> {

  /**
   * Returns a method with a given name, defined as a method of the provided type, defined in the
   * current scope, or {@code null} if not found.
   */
  FunctionType getMethodForType(TypeScopeReferenceType type, String methodName);

  /** Returns the collection containing all imports present in the current module. */
  Collection<ImportExportScopeType> getImports();

  /** Returns the collection containing all exports present in the current module. */
  Collection<ImportExportScopeType> getExports();

  FunctionType getConversionFor(TypeScopeReferenceType target, TypeScopeReferenceType source);

  interface Builder<
      FunctionType,
      TypeScopeReferenceType,
      ImportExportScopeType,
      ModuleScopeType extends
          CommonModuleScopeShape<FunctionType, TypeScopeReferenceType, ImportExportScopeType>> {

    /**
     * Builds the module scope and seals it, making it immutable.
     *
     * <p>The builder should not be used anymore after this method has been called.
     */
    ModuleScopeType build();

    /** Returns the type (type-scope) associated with the current module. */
    TypeScopeReferenceType getAssociatedType();

    /** Registers an export in the module scope. */
    void addExport(ImportExportScopeType exportScope);

    /** Registers an import in the module scope. */
    void addImport(ImportExportScopeType importScope);
  }
}
