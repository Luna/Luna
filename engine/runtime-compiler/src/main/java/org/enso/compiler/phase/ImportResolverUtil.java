package org.enso.compiler.phase;


import org.enso.compiler.core.ir.expression.errors.ImportExport;

import org.enso.compiler.Compiler;
import org.enso.compiler.context.CompilerContext;
import org.enso.compiler.core.CompilerError;
import org.enso.compiler.core.ir.module.scope.Import;
import org.enso.compiler.data.BindingsMap;
import org.enso.compiler.core.ir.Module;
import org.enso.compiler.core.ir.Name;
import org.enso.compiler.core.ir.module.scope.Export;
import org.enso.compiler.data.BindingsMap$ModuleReference$Concrete;
import org.enso.compiler.data.BindingsMap.ResolvedModule;
import org.enso.compiler.data.BindingsMap.ResolvedType;
import org.enso.editions.LibraryName;
import org.enso.polyglot.CompilationStage;

import scala.Option;
import scala.Tuple2;
import scala.collection.immutable.List;
import scala.jdk.CollectionConverters;

public final class ImportResolverUtil extends ImportResolver {
  public ImportResolverUtil(Compiler c) {
    super(c);
  }

  @Override
  public Tuple2<Import, Option<BindingsMap.ResolvedImport>> tryResolveImport(
    Module module,
    Import.Module imp
  ) {
      var res = tryResolveImportNew(module, imp);

      var old = res;
      assert res.equals(old = tryResolveImportOld(module, imp)) : "old:\n" + old._1.pretty() + "\nnew:\n" + res._1.pretty();

      return res;
  }

  private Tuple2<Import, Option<BindingsMap.ResolvedImport>> tryResolveImportNew(
    Module module,
    Import.Module imp
  ) {
    var impName = imp.name().name();
    var exp = CollectionConverters.SeqHasAsJava(module.exports()).asJava().stream().map(e -> switch (e) {
        case Export.Module ex when ex.name().name().equals(impName) -> ex;
        case null, default -> null;
    }).filter(e -> e != null).toList();
    var fromAllExports = exp.stream().filter(ex -> ex.isAll()).toList();

    // switch (fromAllExports) {
    //   case _ :: _ :: _ =>

    if (fromAllExports.size() >= 2) {
        // Detect potential conflicts when importing all and hiding names for the exports of the same module
        var unqualifiedImports = fromAllExports.stream().filter(e -> e.onlyNames().isEmpty()).toList();
        var qualifiedImports = fromAllExports.stream().map(e -> {
            if (e.onlyNames().isDefined()) {
                var onlyNames = CollectionConverters.SeqHasAsJava(e.onlyNames().get()).asJava();
                return onlyNames.stream().map(n -> n.name()).toList();
            } else {
                return null;
            }
        }).filter(e -> e != null).toList();
        var importsWithHiddenNames = fromAllExports.stream().map(e -> {
            if (e.hiddenNames().isDefined()) {
                var hiddenNames = CollectionConverters.SeqHasAsJava(e.hiddenNames().get()).asJava();
                return new Tuple2<>(e, hiddenNames);
            } else {
                return null;
            }
        }).filter(e -> e != null).toList();

        for (var h : importsWithHiddenNames) {
            var e = h._1;
            var hidden = h._2;
            var unqualifiedConflicts = unqualifiedImports.stream().filter(x -> x != e).toList();
            if (!unqualifiedConflicts.isEmpty()) {
              var b = toScalaList(hidden.stream().map(x -> x.name()).toList());
              throw new HiddenNamesShadowUnqualifiedExport(
                e.name().name(), b
              );
            }

        }
        for (var h : importsWithHiddenNames) {
            var e = h._1;
            var hidden = h._2;
            var qualifiedConflicts = qualifiedImports.stream().filter(x -> x != e)
              .flatMap(x -> x.stream())
              .filter(f -> hidden.stream().filter(x -> f.equals(x.name())).findAny().isPresent())
              .toList();
          if (!qualifiedConflicts.isEmpty()) {
              var b = toScalaList(qualifiedConflicts);
            throw new HiddenNamesShadowQualifiedExport(
              e.name().name(), b

            );
          }
        }
    };
    var parts = imp.name().parts();
    if (parts.length() < 2) {
        throw new CompilerError(
          "Imports should contain at least two segments after " +
          "desugaring."
        );
    }
    var compiler = this.getCompiler();
    var repo = compiler.packageRepository();
    var twoParts = parts.take(2);
    var libraryName = new LibraryName(twoParts.head().name(), twoParts.last().name());
    var foundLib = repo.ensurePackageIsLoaded(libraryName);
    if (foundLib.isRight()) {
        var moduleOption = compiler.getModule(impName);
        if (moduleOption.isDefined()) {
            var m = moduleOption.get();
            var someBinding = Option.apply(new BindingsMap.ResolvedImport(
                  imp,
                  toScalaList(exp),
                  new ResolvedModule(new BindingsMap$ModuleReference$Concrete(m))
            ));
            return new Tuple2<>(imp, someBinding);
        } else {
            var typ = tryResolveAsTypeNew(imp.name());
            if (typ != null) {
                var someBinding = Option.apply(new BindingsMap.ResolvedImport(imp, toScalaList(exp), typ));
                return new Tuple2<>(imp, someBinding);
            } else {
                return new Tuple2<>(
                  new ImportExport(
                    imp,
                    new ImportExport.ModuleDoesNotExist(impName),
                          imp.passData(), imp.diagnostics()
                  ),
                  Option.empty()
                );
            }
        }
    } else {
        var loadingError = foundLib.left().getOrElse(null).toString();
        var importError = new ImportExport(
            imp,
            new ImportExport.PackageCouldNotBeLoaded(
              impName,
              loadingError
            ), imp.passData(), imp.diagnostics());
        return new Tuple2<>(
            importError, Option.empty()
        );
    }
  }

  private ResolvedType tryResolveAsTypeNew(Name.Qualified name) {
    var parts = CollectionConverters.SeqHasAsJava(name.parts()).asJava();
    var last = parts.size() - 1;
    var tp  = parts.get(last).name();
    var modName = String.join(".", parts.subList(0, last).stream().map(n -> n.name()).toList());
    var compiler = this.getCompiler();
    var optionMod = compiler.getModule(modName);
    if (optionMod.isDefined()) {
      var mod= optionMod.get();
      compiler.ensureParsed(mod);
      var b = mod.getBindingsMap();
      if (b == null) {
        compiler.context().updateModule(
          mod,
          u -> {
            u.invalidateCache();
            u.ir(null);
            u.compilationStage(CompilationStage.INITIAL);
          }
        );
        compiler.ensureParsed(mod, false);
        b = mod.getBindingsMap();
      }

        var entities = CollectionConverters.SeqHasAsJava(b.definedEntities()).asJava();
        var type = entities.stream().filter(e -> e.name().equals(tp))
                .map(e -> switch (e) {
                    case BindingsMap.Type t -> new ResolvedType(new BindingsMap$ModuleReference$Concrete(mod), t);
                    case null, default -> null;
                }).filter(e -> e != null).findFirst();
        return type.orElse(null);
    } else {
        return null;
    }
  }

  private static <T> List<T> toScalaList(java.util.List<T> qualifiedConflicts) {
    return CollectionConverters.ListHasAsScala(qualifiedConflicts).asScala().toList();
  }

}
