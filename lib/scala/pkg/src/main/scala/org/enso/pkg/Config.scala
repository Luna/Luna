package org.enso.pkg

import io.circe.syntax._
import io.circe.generic.auto._
import io.circe.{yaml, Decoder, Encoder, Json}
import io.circe.yaml.Printer

import scala.util.Try

case class Dependency(name: String, version: String)
case class Contact(name: String, email: Option[String]) {
  override def toString: String =
    name + email.map(email => s" <$email>").getOrElse("")
}

/**
  * Represents a package configuration stored in the `package.yaml` file.
  *
  * @param name package name
  * @param version package version
  * @param ensoVersion version of the Enso engine associated with the package,
  *                    can be set to `default` which defaults to the locally
  *                    installed version
  * @param license package license
  * @param author name and contact information of the package author(s)
  * @param maintainer name and contact information of current package
  *                   maintainer(s)
  * @param dependencies a list of package dependencies
  * @param originalJson a Json object holding the original values that this
  *                     Config was created from, used to preserve configuration
  *                     keys that are not known
  */
case class Config(
  name: String,
  version: String,
  ensoVersion: EnsoVersion,
  license: String,
  author: List[Contact],
  maintainer: List[Contact],
  dependencies: List[Dependency],
  originalJson: Json = Json.obj()
) {

  /**
    * Converts the configuration into a YAML representation.
    */
  def toYaml: String =
    Printer.spaces2.copy(preserveOrder = true).pretty(Config.encoder(this))
}

object Config {
  private object JsonFields {
    val name: String         = "name"
    val version: String      = "version"
    val ensoVersion: String  = "enso-version"
    val license: String      = "license"
    val author: String       = "author"
    val maintainer: String   = "maintainer"
    val dependencies: String = "dependencies"
  }

  private val decodeContactsList: Decoder[List[Contact]] = { json =>
    def decodeContactString(string: String): Contact = {
      val contactRegex = """(.*) <(.*)>""".r
      string match {
        case contactRegex(name, email) => Contact(name, Some(email))
        case justName                  => Contact(justName, None)
      }
    }

    json
      .as[String]
      .map(str => if (str.isEmpty) List() else List(str))
      .orElse(json.as[List[String]])
      .map(_.map(decodeContactString))
  }

  private val encodeContactsList: Encoder[List[Contact]] = {
    case List()     => "".asJson
    case List(elem) => elem.toString.asJson
    case l          => l.map(_.toString).asJson
  }

  implicit val decoder: Decoder[Config] = { json =>
    for {
      name    <- json.get[String](JsonFields.name)
      version <- json.getOrElse[String](JsonFields.version)("dev")
      ensoVersion <-
        json.getOrElse[EnsoVersion](JsonFields.ensoVersion)(DefaultEnsoVersion)
      license <- json.getOrElse(JsonFields.license)("")
      author <- json.getOrElse[List[Contact]](JsonFields.author)(List())(
        decodeContactsList
      )
      maintainer <-
        json.getOrElse[List[Contact]](JsonFields.maintainer)(List())(
          decodeContactsList
        )
      dependencies <- json.getOrElse[List[Dependency]](JsonFields.dependencies)(
        List()
      )
    } yield Config(
      name,
      version,
      ensoVersion,
      license,
      author,
      maintainer,
      dependencies,
      json.value
    )
  }

  implicit val encoder: Encoder[Config] = { config =>
    val originals = config.originalJson
    val overrides = Json.obj(
      JsonFields.name        -> config.name.asJson,
      JsonFields.version     -> config.version.asJson,
      JsonFields.ensoVersion -> config.ensoVersion.asJson,
      JsonFields.license     -> config.license.asJson,
      JsonFields.author      -> encodeContactsList(config.author),
      JsonFields.maintainer  -> encodeContactsList(config.maintainer)
    )
    val base = originals.deepMerge(overrides)
    val withDeps =
      if (config.dependencies.nonEmpty)
        base.deepMerge(
          Json.obj(JsonFields.dependencies -> config.dependencies.asJson)
        )
      else base
    withDeps
  }

  def fromYaml(yamlString: String): Try[Config] = {
    yaml.parser.parse(yamlString).flatMap(_.as[Config]).toTry
  }
}
