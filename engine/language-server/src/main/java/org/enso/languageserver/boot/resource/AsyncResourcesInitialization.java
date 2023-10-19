package org.enso.languageserver.boot.resource;

import java.util.Arrays;
import java.util.concurrent.CompletableFuture;

public class AsyncResourcesInitialization implements InitializationComponent {

  private final InitializationComponent[] resources;

  public AsyncResourcesInitialization(InitializationComponent... resources) {
    this.resources = resources;
  }

  @Override
  public boolean isInitialized() {
    return Arrays.stream(resources).allMatch(InitializationComponent::isInitialized);
  }

  @Override
  public CompletableFuture<Void> init() {
    return CompletableFuture.allOf(
            Arrays.stream(resources)
                .map(
                    component ->
                        component.isInitialized()
                            ? CompletableFuture.completedFuture(null)
                            : component.init())
                .toArray(CompletableFuture<?>[]::new))
        .thenRun(() -> {});
  }
}
