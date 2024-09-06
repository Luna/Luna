package org.enso.projectmanager.protocol

import org.enso.semver.SemVer
import org.enso.runtimeversionmanager.test.OverrideTestVersionSuite
import org.enso.testkit.ReportLogsOnFailure

class ProjectOpenMissingComponentsSpec
    extends ProjectOpenSpecBase
    with OverrideTestVersionSuite
    with ReportLogsOnFailure {

  override val testVersion: SemVer = defaultVersion

  override def beforeAll(): Unit = {
    super.beforeAll()
    uninstallEngine(defaultVersion)
  }

  "project/open" should {
    behave like correctlyHandleMissingComponents()
  }

}
