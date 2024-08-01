package org.enso.interpreter.runtime;

import java.lang.module.Configuration;
import java.lang.module.ModuleFinder;
import java.nio.file.Path;
import java.util.Collections;
import java.util.List;

/** Representation of an Enso library class path. */
public final class EnsoClassPath {
  private static final EnsoClassPath EMPTY = new EnsoClassPath(null, null, null);
  private final ModuleLayer.Controller cntrl;
  private final ModuleLayer layer;
  final ClassLoader loader;

  private EnsoClassPath(ModuleLayer.Controller cntrl, ModuleLayer layer, ClassLoader loader) {
    this.cntrl = cntrl;
    this.layer = layer;
    this.loader = loader;
  }

  static EnsoClassPath create(Path file, List<EnsoClassPath> parents) {
    java.lang.module.ModuleFinder finder = ModuleFinder.of(file);
    java.util.List<java.lang.String> moduleNames =
        finder.findAll().stream().map(mod -> mod.descriptor().name()).toList();
    if (moduleNames.isEmpty()) {
      return EMPTY;
    } else {
      ModuleLayer.Controller cntrl;
      if (parents.isEmpty()) {
        var parent = ModuleLayer.boot();
        var parentLoader = parent.findLoader("java.base");
        var parentCfgs = Collections.singletonList(parent.configuration());
        var parentModules = Collections.singletonList(parent);
        var cfg =
            Configuration.resolveAndBind(finder, parentCfgs, ModuleFinder.ofSystem(), moduleNames);
        cntrl = ModuleLayer.defineModulesWithOneLoader(cfg, parentModules, parentLoader);
      } else {
        var parentCfgs = parents.stream().map(cp -> cp.layer.configuration()).toList();
        var parentLayers = parents.stream().map(cp -> cp.layer).toList();
        var parentLoader = ModuleLayer.boot().findLoader("java.base");
        var cfg =
            Configuration.resolveAndBind(finder, parentCfgs, ModuleFinder.ofSystem(), moduleNames);
        cntrl = ModuleLayer.defineModulesWithManyLoaders(cfg, parentLayers, parentLoader);
      }
      var layer = cntrl.layer();
      var loader = layer.findLoader(moduleNames.get(0));
      return new EnsoClassPath(cntrl, layer, loader);
    }
  }
}
