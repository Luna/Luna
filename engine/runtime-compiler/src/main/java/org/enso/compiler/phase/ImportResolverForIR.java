package org.enso.compiler.phase;

import java.io.IOException;
import java.util.Objects;

import org.enso.compiler.Compiler;
import org.enso.compiler.context.CompilerContext;
import org.enso.compiler.core.ir.Module;
import org.enso.compiler.core.ir.Name;
import org.enso.compiler.core.ir.expression.errors.ImportExport;
import org.enso.compiler.core.ir.module.scope.Export;
import org.enso.compiler.core.ir.module.scope.Import;
import org.enso.compiler.data.BindingsMap;
import org.enso.compiler.data.BindingsMap$ModuleReference$Concrete;
import org.enso.compiler.data.BindingsMap.ResolvedType;
import org.enso.editions.LibraryName;
import org.enso.polyglot.CompilationStage;

import scala.Option;
import scala.Tuple2;
import scala.collection.immutable.List;
import scala.jdk.CollectionConverters;

abstract class ImportResolverForIR extends ImportResolverAlgorithm<Tuple2<Import, Option<BindingsMap.ResolvedImport>>, Import.Module, Export.Module> {
  abstract Compiler getCompiler();

  @Override
  final Name.Qualified nameForImport(Import.Module imp) {
    return imp.name();
  }

  @Override
  final Name.Qualified nameForExport(Export.Module ex) {
    return ex.name();
  }

  @Override
  final String nameForType(BindingsMap.ResolvedType e) {
    return e.qualifiedName().item();
  }

  @Override
  final java.util.List<Export.Module> exportsFor(Module module, String impName) {
    java.util.List<Export.Module> exp = CollectionConverters.SeqHasAsJava(module.exports()).asJava().stream().map(e -> switch (e) {
      case Export.Module ex when ex.name().name().equals(impName) -> ex;
      case null, default -> null;
    }).filter(Objects::nonNull).toList();
    return exp;
  }

  @Override
  final boolean isAll(Export.Module ex) {
    return ex.isAll();
  }

  @Override
  final java.util.List<Name.Literal> onlyNames(Export.Module ex) {
    if (ex.onlyNames().isEmpty()) {
      return null;
    }
    java.util.List<Name.Literal> list = CollectionConverters.SeqHasAsJava(ex.onlyNames().get()).asJava();
    return list;
  }

  @Override
  final java.util.List<Name.Literal> hiddenNames(Export.Module ex) {
    if (ex.hiddenNames().isEmpty()) {
      return null;
    }
    java.util.List<Name.Literal> list = CollectionConverters.SeqHasAsJava(ex.hiddenNames().get()).asJava();
    return list;
  }

  @Override
  final java.util.List<BindingsMap.ResolvedType> definedEntities(String name) {
    var compiler = this.getCompiler();
    var optionMod = compiler.getModule(name);
    if (optionMod.isEmpty()) {
      return null;
    }
    var mod = optionMod.get();
    compiler.ensureParsed(mod);
    var b = mod.getBindingsMap();
    if (b == null) {
      compiler.context().updateModule(mod, u -> {
        u.invalidateCache();
        u.ir(null);
        u.compilationStage(CompilationStage.INITIAL);
      });
      compiler.ensureParsed(mod, false);
      b = mod.getBindingsMap();
    }
    var entitiesStream = b.definedEntities().map(e -> switch (e) {
      case BindingsMap.Type t -> {
        assert e.name().equals(t.name()) : e.name() + " != " + t.name();
        var res = new ResolvedType(new BindingsMap$ModuleReference$Concrete(mod), t);
        assert e.name().equals(res.tp().name()) : e.name() + " != " + res.tp().name();
        yield res;
      }
      case null, default -> null;
    }).filter(Objects::nonNull);
    var entities = CollectionConverters.SeqHasAsJava(entitiesStream).asJava();
    return entities;
  }

  @Override
  final CompilerContext.Module loadLibraryModule(LibraryName libraryName, String moduleName) throws IOException {
    var compiler = this.getCompiler();
    var repo = compiler.packageRepository();
    var foundLib = repo.ensurePackageIsLoaded(libraryName);
    if (foundLib.isRight()) {
      var moduleOption = compiler.getModule(moduleName);
      if (moduleOption.isDefined()) {
        return moduleOption.get();
      } else {
        return null;
      }
    } else {
      throw new IOException(foundLib.left().getOrElse(null).toString());
    }
  }

  @Override
  final Tuple2<Import, Option<BindingsMap.ResolvedImport>> tupleResolvedImport(Import.Module imp, java.util.List<Export.Module> exp, CompilerContext.Module m) {
    scala.Option<org.enso.compiler.data.BindingsMap.ResolvedImport> someBinding = Option.apply(new BindingsMap.ResolvedImport(imp, toScalaList(exp), new BindingsMap.ResolvedModule(new BindingsMap$ModuleReference$Concrete(m))));
    return new Tuple2<>(imp, someBinding);
  }

  @Override
  final Tuple2<Import, Option<BindingsMap.ResolvedImport>> tupleResolvedType(Import.Module imp, java.util.List<Export.Module> exp, BindingsMap.ResolvedType typ) {
    scala.Option<org.enso.compiler.data.BindingsMap.ResolvedImport> someBinding = Option.apply(new BindingsMap.ResolvedImport(imp, toScalaList(exp), typ));
    return new Tuple2<>(imp, someBinding);
  }

  @Override
  final Tuple2<Import, Option<BindingsMap.ResolvedImport>> tupleErrorPackageCoundNotBeLoaded(Import.Module imp, String impName, String loadingError) {
    org.enso.compiler.core.ir.expression.errors.ImportExport importError = new ImportExport(imp, new ImportExport.PackageCouldNotBeLoaded(impName, loadingError), imp.passData(), imp.diagnostics());
    return new Tuple2<>(importError, Option.empty());
  }

  @Override
  final Tuple2<Import, Option<BindingsMap.ResolvedImport>> tupleErrorModuleDoesNotExist(Import.Module imp, String impName) {
    return new Tuple2<>(new ImportExport(imp, new ImportExport.ModuleDoesNotExist(impName), imp.passData(), imp.diagnostics()), Option.empty());
  }

  private static <T> List<T> toScalaList(java.util.List<T> qualifiedConflicts) {
    return CollectionConverters.ListHasAsScala(qualifiedConflicts).asScala().toList();
  }
}
