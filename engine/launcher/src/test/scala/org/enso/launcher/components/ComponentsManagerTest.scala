package org.enso.launcher.components

import java.nio.file.Path

import org.enso.launcher.cli.GlobalCLIOptions
import org.enso.launcher.installation.DistributionManager
import org.enso.launcher.releases.{
  EngineReleaseProvider,
  GraalCEReleaseProvider
}
import org.enso.launcher.{FakeEnvironment, WithTemporaryDirectory}
import org.scalatest.OptionValues
import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpec

class ComponentsManagerTest
    extends AnyWordSpec
    with Matchers
    with OptionValues
    with WithTemporaryDirectory
    with FakeEnvironment {
  def makeManagers(): (DistributionManager, ComponentsManager) = {
    val distributionManager = new DistributionManager(
      fakeInstalledEnvironment()
    )
    val fakeReleasesRoot =
      Path.of(
        getClass
          .getResource("/org/enso/launcher/components/fake-releases")
          .toURI
      )
    val engineProvider = new EngineReleaseProvider(
      FakeReleaseProvider(fakeReleasesRoot.resolve("enso"))
    )
    val runtimeProvider = new GraalCEReleaseProvider(
      FakeReleaseProvider(fakeReleasesRoot.resolve("graalvm"))
    )
    val componentsManager = new ComponentsManager(
      GlobalCLIOptions(autoConfirm = true, hideProgress = true),
      distributionManager,
      engineProvider,
      runtimeProvider
    )

    (distributionManager, componentsManager)
  }

  def makeComponentsManager(): ComponentsManager = makeManagers()._2
}
