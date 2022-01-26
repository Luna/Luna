package org.enso.pkg

import cats.Show
import io.circe.{DecodingFailure, Json, JsonObject}
import nl.gn0s1s.bump.SemVer
import org.enso.editions.LibraryName
import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpec
import org.scalatest.{Inside, OptionValues}

class ConfigSpec
    extends AnyWordSpec
    with Matchers
    with Inside
    with OptionValues {

  "Config" should {
    "preserve unknown keys when deserialized and serialized again" in {
      val original = Json.obj(
        "name"        -> Json.fromString("name"),
        "unknown-key" -> Json.fromString("value")
      )

      inside(original.as[Config]) { case Right(config) =>
        val serialized = Config.encoder(config)
        serialized.asObject
          .value("unknown-key")
          .value
          .asString
          .value shouldEqual "value"
      }
    }

    "deserialize the serialized representation to the original value" in {
      val config = Config(
        name      = "placeholder",
        version   = "dev",
        namespace = "local",
        edition =
          Some(Config.makeCompatibilityEditionFromVersion(SemVer(4, 5, 6))),
        license = "none",
        authors = List(),
        maintainers = List(
          Contact(Some("A"), Some("a@example.com")),
          Contact(Some("B"), None),
          Contact(None, Some("c@example.com"))
        ),
        preferLocalLibraries = true,
        componentGroups      = Right(ComponentGroups.empty)
      )
      val deserialized = Config.fromYaml(config.toYaml).get
      val withoutJson  = deserialized.copy(originalJson = JsonObject())
      withoutJson shouldEqual config
    }

    "only require the name and use defaults for everything else" in {
      val parsed = Config.fromYaml("name: FooBar").get
      parsed.name shouldEqual "FooBar"
      parsed.edition shouldBe empty
    }

    "be backwards compatible but correctly migrate to new format on save" in {
      val oldFormat =
        """name: FooBar
          |enso-version: 1.2.3
          |extra-key: extra-value
          |""".stripMargin
      val parsed = Config.fromYaml(oldFormat).get

      parsed.edition.get.engineVersion should contain(SemVer(1, 2, 3))

      val serialized  = parsed.toYaml
      val parsedAgain = Config.fromYaml(serialized).get

      parsedAgain.copy(originalJson = JsonObject()) shouldEqual
      parsed.copy(originalJson      = JsonObject())

      parsedAgain.originalJson("extra-key").flatMap(_.asString) should contain(
        "extra-value"
      )
    }

    "correctly de-serialize and serialize back the shortened edition syntax " +
    "if there are no overrides" in {
      val config =
        """name: FooBar
          |edition: 2020.1
          |""".stripMargin
      val parsed = Config.fromYaml(config).get

      parsed.edition.get.parent should contain("2020.1")

      val serialized = parsed.toYaml
      serialized should include("edition: '2020.1'")
    }
  }

  "Component groups" should {

    "correctly de-serialize and serialize back the components syntax" in {
      val config =
        """name: FooBar
          |component-groups:
          |  new:
          |  - Group 1:
          |    color: '#C047AB'
          |    icon: icon-name
          |    exports:
          |      - foo:
          |        shortcut: f
          |      - bar
          |  extends:
          |  - Standard.Base.Group 2:
          |    exports:
          |      - bax
          |""".stripMargin
      val parsed = Config.fromYaml(config).get

      val expectedComponentGroups = ComponentGroups(
        newGroups = List(
          ComponentGroup(
            module = ModuleName("Group 1"),
            color  = Some("#C047AB"),
            icon   = Some("icon-name"),
            exports = List(
              Component("foo", Some(Shortcut("f"))),
              Component("bar", None)
            )
          )
        ),
        extendedGroups = List(
          ExtendedComponentGroup(
            module = ModuleReference(
              LibraryName("Standard", "Base"),
              Some(ModuleName("Group 2"))
            ),
            color   = None,
            icon    = None,
            exports = List(Component("bax", None))
          )
        )
      )
      parsed.componentGroups shouldEqual Right(expectedComponentGroups)

      val serialized = parsed.toYaml
      serialized should include(
        """component-groups:
          |  new:
          |  - module: Group 1
          |    color: '#C047AB'
          |    icon: icon-name
          |    exports:
          |    - name: foo
          |      shortcut: f
          |    - bar
          |  extends:
          |  - module: Standard.Base.Group 2
          |    exports:
          |    - bax""".stripMargin.linesIterator.mkString("\n")
      )
    }

    "correctly de-serialize empty components" in {
      val config =
        """name: FooBar
          |component-groups:
          |""".stripMargin
      val parsed = Config.fromYaml(config).get

      parsed.componentGroups shouldEqual Right(ComponentGroups.empty)
    }

    "allow unknown keys in component groups" in {
      val config =
        """name: FooBar
          |component-groups:
          |  foo:
          |  - Group 1:
          |    exports:
          |    - bax
          |""".stripMargin
      val parsed = Config.fromYaml(config).get

      parsed.componentGroups shouldEqual Right(ComponentGroups.empty)
    }

    "fail to de-serialize invalid extended modules" in {
      val config =
        """name: FooBar
          |component-groups:
          |  extends:
          |  - Group 1:
          |    exports:
          |    - bax
          |""".stripMargin
      val parsed = Config.fromYaml(config).get

      parsed.componentGroups match {
        case Left(f: DecodingFailure) =>
          Show[DecodingFailure].show(f) should include(
            "Failed to decode 'Group 1' as module reference"
          )
        case unexpected =>
          fail(s"Unexpected result: $unexpected")
      }
    }

    "correctly de-serialize shortcuts" in {
      val config =
        """name: FooBar
          |component-groups:
          |  new:
          |  - Group 1:
          |    exports:
          |    - foo:
          |      shortcut: f
          |    - bar:
          |      shortcut: fgh
          |    - baz:
          |      shortcut: 0
          |    - quux:
          |      shortcut:
          |    - hmmm:
          |""".stripMargin
      val parsed = Config.fromYaml(config).get
      val expectedComponentGroups = ComponentGroups(
        newGroups = List(
          ComponentGroup(
            module = ModuleName("Group 1"),
            color  = None,
            icon   = None,
            exports = List(
              Component("foo", Some(Shortcut("f"))),
              Component("bar", Some(Shortcut("fgh"))),
              Component("baz", Some(Shortcut("0"))),
              Component("quux", None),
              Component("hmmm", None)
            )
          )
        ),
        extendedGroups = List()
      )

      parsed.componentGroups shouldEqual Right(expectedComponentGroups)
    }

    "fail to de-serialize invalid shortcuts" in {
      val config =
        """name: FooBar
          |component-groups:
          |  new:
          |  - Group 1:
          |    exports:
          |    - foo:
          |      shortcut: []
          |""".stripMargin
      val parsed = Config.fromYaml(config).get
      parsed.componentGroups match {
        case Left(f: DecodingFailure) =>
          Show[DecodingFailure].show(f) should include(
            "Failed to decode shortcut"
          )
        case unexpected =>
          fail(s"Unexpected result: $unexpected")
      }
    }

    "fail to de-serialize invalid component groups" in {
      val config =
        """name: FooBar
          |component-groups:
          |  new:
          |  - exports:
          |    - name: foo
          |""".stripMargin
      val parsed = Config.fromYaml(config).get
      parsed.componentGroups match {
        case Left(f: DecodingFailure) =>
          Show[DecodingFailure].show(f) should include(
            "Failed to decode component group name"
          )
        case unexpected =>
          fail(s"Unexpected result: $unexpected")
      }
    }

    "fail to de-serialize invalid components" in {
      val config =
        """name: FooBar
          |component-groups:
          |  new:
          |  - Group 1:
          |    exports:
          |    - one: two
          |""".stripMargin
      val parsed = Config.fromYaml(config).get
      parsed.componentGroups match {
        case Left(f: DecodingFailure) =>
          Show[DecodingFailure].show(f) should include(
            "Failed to decode component name"
          )
        case unexpected =>
          fail(s"Unexpected result: $unexpected")
      }
    }
  }

}
