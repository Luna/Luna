package org.enso.compiler.pass.analyse.types.scope;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;
import org.enso.compiler.MetadataInteropHelpers;
import org.enso.compiler.context.InlineContext;
import org.enso.compiler.context.ModuleContext;
import org.enso.compiler.core.IR;
import org.enso.compiler.core.ir.Expression;
import org.enso.compiler.core.ir.Module;
import org.enso.compiler.core.ir.module.scope.Definition;
import org.enso.compiler.core.ir.module.scope.Import;
import org.enso.compiler.core.ir.module.scope.definition.Method;
import org.enso.compiler.data.BindingsMap;
import org.enso.compiler.pass.IRPass;
import org.enso.compiler.pass.analyse.types.InferredType;
import org.enso.compiler.pass.analyse.types.TypeInferenceSignatures;
import org.enso.compiler.pass.analyse.types.TypeRepresentation;
import org.enso.compiler.pass.analyse.types.TypeResolver;
import org.enso.compiler.pass.resolve.FullyQualifiedNames$;
import org.enso.compiler.pass.resolve.GlobalNames$;
import org.enso.compiler.pass.resolve.MethodDefinitions$;
import org.enso.compiler.pass.resolve.TypeNames$;
import scala.collection.immutable.Seq;
import scala.jdk.javaapi.CollectionConverters;
import scala.jdk.javaapi.CollectionConverters$;

public class StaticModuleScopeAnalysis implements IRPass {
  public static final StaticModuleScopeAnalysis INSTANCE = new StaticModuleScopeAnalysis();

  private final TypeResolver typeResolver = new TypeResolver();

  private StaticModuleScopeAnalysis() {}

  private UUID uuid;

  @Override
  public void org$enso$compiler$pass$IRPass$_setter_$key_$eq(UUID v) {
    this.uuid = v;
  }

  @Override
  public UUID key() {
    return uuid;
  }

  @Override
  public String toString() {
    return "StaticModuleScopeAnalysis";
  }

  @Override
  public Seq<IRPass> precursorPasses() {
    List<IRPass> passes =
        List.of(
            GlobalNames$.MODULE$,
            FullyQualifiedNames$.MODULE$,
            TypeNames$.MODULE$,
            TypeInferenceSignatures.INSTANCE);
    return CollectionConverters.asScala(passes).toList();
  }

  @Override
  @SuppressWarnings("unchecked")
  public Seq<IRPass> invalidatedPasses() {
    List<IRPass> passes = List.of();
    return CollectionConverters.asScala(passes).toList();
  }

  @Override
  public Module runModule(Module ir, ModuleContext moduleContext) {
    // This has a lot in common with IrToTruffle::processModule - we may want to extract some common
    // parts if it will make sense.
    StaticModuleScope scope = new StaticModuleScope(moduleContext.getName());
    processModuleExports(scope, ir);
    processModuleImports(scope, ir);
    processPolyglotImports(scope, ir);
    processBindings(scope, ir);
    ir.passData().update(INSTANCE, scope);
    return ir;
  }

  @Override
  public Expression runExpression(Expression ir, InlineContext inlineContext) {
    // Nothing to do - this pass only works on module-level.
    return ir;
  }

  private void processModuleImports(StaticModuleScope scope, Module module) {
    module
        .imports()
        .foreach(
            imp -> {
              if (imp instanceof Import.Module moduleImport) {
                var importScope = StaticImportExportScope.buildFrom(moduleImport);
                scope.registerModuleImport(importScope);
              }
              return null;
            });
  }

  private void processModuleExports(StaticModuleScope scope, Module module) {
    // TODO
  }

  private void processPolyglotImports(StaticModuleScope scope, Module module) {
    // TODO
  }

  private void processBindings(StaticModuleScope scope, Module module) {
    module
        .bindings()
        .foreach(
            binding -> {
              switch (binding) {
                case Definition.Type typ -> processType(scope, typ);
                case Method.Explicit method -> processMethod(scope, method);
                case Method.Conversion conversion -> processConversion(scope, conversion);
                default -> System.out.println(
                    "Unexpected binding type: " + binding.getClass().getCanonicalName());
              }
              return null;
            });
  }

  @Override
  public <T extends IR> T updateMetadataInDuplicate(T sourceIr, T copyOfIr) {
    return IRPass.super.updateMetadataInDuplicate(sourceIr, copyOfIr);
  }

  private void processType(StaticModuleScope scope, Definition.Type type) {
    List<AtomType.Constructor> constructors =
        CollectionConverters$.MODULE$.asJava(type.members()).stream()
            .map(
                constructorDef ->
                    new AtomType.Constructor(
                        constructorDef.name().name(), constructorDef.isPrivate()))
            .toList();

    AtomType atomType = new AtomType(type.name().name(), constructors, scope);
    var qualifiedName = scope.getModuleName().createChild(type.name().name());
    var atomTypeScope = TypeScopeReference.atomType(qualifiedName);
    scope.registerType(atomType);
    registerFieldGetters(scope, atomTypeScope, type);
  }

  /**
   * Registers getters for fields of the given type.
   *
   * <p>This should be consistent with logic with AtomConstructor.collectFieldAccessors.
   */
  private void registerFieldGetters(
      StaticModuleScope scope, TypeScopeReference typeScope, Definition.Type typeDefinition) {
    HashMap<String, List<TypeRepresentation>> fieldTypes = new HashMap<>();
    for (var constructorDef : CollectionConverters$.MODULE$.asJava(typeDefinition.members())) {
      for (var argumentDef : CollectionConverters$.MODULE$.asJava(constructorDef.arguments())) {
        String fieldName = argumentDef.name().name();
        TypeRepresentation fieldType =
            argumentDef
                .ascribedType()
                .map(typeResolver::resolveTypeExpression)
                .getOrElse(() -> TypeRepresentation.UNKNOWN);
        fieldTypes.computeIfAbsent(fieldName, k -> new ArrayList<>()).add(fieldType);
      }
    }

    for (var entry : fieldTypes.entrySet()) {
      String fieldName = entry.getKey();
      TypeRepresentation mergedType = TypeRepresentation.buildSimplifiedSumType(entry.getValue());
      scope.registerMethod(typeScope, fieldName, mergedType);
    }
  }

  private void processMethod(StaticModuleScope scope, Method.Explicit method) {
    var typeScope = getTypeAssociatedWithMethod(scope, method);
    if (typeScope == null) {
      System.out.println(
          "Failed to process method "
              + method.methodReference().showCode()
              + ", because its type scope could not be resolved.");
      return;
    }
    var typeFromSignature =
        MetadataInteropHelpers.getMetadataOrNull(
            method, TypeInferenceSignatures.INSTANCE, InferredType.class);
    var type = typeFromSignature != null ? typeFromSignature.type() : TypeRepresentation.UNKNOWN;
    var name = method.methodReference().methodName().name();
    scope.registerMethod(typeScope, name, type);
  }

  TypeScopeReference getTypeAssociatedWithMethod(StaticModuleScope scope, Method.Explicit method) {
    // TODO this should be synchronized with declaredConsOpt of IrToTruffle::processModule -
    // probably good to extract a common algorithm
    boolean isStatic = method.isStatic();

    var typePointerOpt = method.methodReference().typePointer();
    if (typePointerOpt.isEmpty()) {
      // A method not associated to a type - this is a module method.
      // TODO should we check isStatic here?
      return scope.getAssociatedType();
    } else {
      var metadata =
          MetadataInteropHelpers.getMetadataOrNull(
              typePointerOpt.get(), MethodDefinitions$.MODULE$, BindingsMap.Resolution.class);
      if (metadata == null) {
        System.out.println(
            "Method type pointer of "
                + method.methodReference().showCode()
                + " does not have MethodDefinition metadata. Should this be compiler"
                + " error?");
        return null;
      }

      return switch (metadata.target()) {
        case BindingsMap.ResolvedType resolvedType -> TypeScopeReference.atomType(
            resolvedType.qualifiedName(), isStatic);
        case BindingsMap.ResolvedModule resolvedModule -> {
          assert !isStatic;
          yield TypeScopeReference.moduleAssociatedType(resolvedModule.qualifiedName());
        }
        default -> throw new IllegalStateException(
            "Unexpected target type: " + metadata.target().getClass().getCanonicalName());
      };
    }
  }

  private void processConversion(StaticModuleScope scope, Method.Conversion conversion) {
    // TODO later
  }
}
