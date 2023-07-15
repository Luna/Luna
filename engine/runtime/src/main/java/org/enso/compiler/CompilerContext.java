package org.enso.compiler;

import com.oracle.truffle.api.TruffleFile;
import com.oracle.truffle.api.source.Source;
import java.io.PrintStream;
import java.util.Optional;
import java.util.logging.Level;
import org.enso.compiler.context.InlineContext;
import org.enso.compiler.core.IR;
import org.enso.compiler.data.CompilerConfig;
import org.enso.interpreter.node.ExpressionNode;
import org.enso.interpreter.runtime.Module;
import org.enso.interpreter.runtime.scope.ModuleScope;
import org.enso.interpreter.runtime.scope.TopLevelScope;
import org.enso.pkg.QualifiedName;

interface CompilerContext {
  boolean isIrCachingDisabled();

  boolean isUseGlobalCacheLocations();

  boolean isInteractiveMode();

  PackageRepository getPackageRepository();

  PrintStream getErr();

  PrintStream getOut();

  void log(Level level, String msg, Object... args);

  void logSerializationManager(Level level, String msg, Object... args);

  void notifySerializeModule(QualifiedName moduleName);

  TopLevelScope getTopScope();

  // threads
  boolean isCreateThreadAllowed();

  Thread createThread(Runnable r);

  Thread createSystemThread(Runnable r);

  // Truffle related

  void truffleRunCodegen(Source source, ModuleScope scope, CompilerConfig config, IR.Module ir);

  ExpressionNode truffleRunInline(
      Source source, InlineContext scope, CompilerConfig config, IR.Expression ir);

  // module related

  void invalidateModuleCache(Module module);

  <T> Optional<T> loadCache(Cache<T, ?> cache);

  <T> Optional<TruffleFile> saveCache(Cache<T, ?> cache, T entry, boolean useGlobalCacheLocations);
}
