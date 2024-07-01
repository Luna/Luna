package org.enso.launcher.releases.fallback.staticwebsite

import io.circe.Decoder
import org.enso.yaml.SnakeYamlDecoder
import org.yaml.snakeyaml.nodes.{MappingNode, Node}

import java.io.StringReader
import scala.util.Try

/** Manifest of the fallback mechanism.
  *
  * Specifies whether the mechanism is enabled and should be considered
  * available.
  */
case class FallbackManifest(enabled: Boolean)

object FallbackManifest {

  implicit val decoderSnake: SnakeYamlDecoder[FallbackManifest] =
    new SnakeYamlDecoder[FallbackManifest] {
      override def decode(node: Node) = {
        node match {
          case node: MappingNode =>
            val booleanDecoder = implicitly[SnakeYamlDecoder[Boolean]]
            val bindings       = mappingKV(node)
            for {
              enabled <- bindings
                .get(Fields.enabled)
                .map(booleanDecoder.decode(_))
                .getOrElse(Right(false))
            } yield FallbackManifest(enabled)
        }
      }
    }

  /** Defines a part of the URL scheme of the fallback mechanism - the name of
    * manifest file.
    *
    * That must *never* be changed to ensure that all older launcher versions
    * can be upgraded.
    */
  val fileName = "fallback-manifest.yaml"

  private object Fields {
    val enabled = "enabled"
  }

  /** [[Decoder]] instance for [[FallbackManifest]].
    *
    * It should always remain backwards compatible, since the fallback mechanism
    * must work for all released launcher versions.
    */
  implicit val decoder: Decoder[FallbackManifest] = { json =>
    for {
      enabled <- json.get[Boolean](Fields.enabled)
    } yield FallbackManifest(enabled)
  }

  def parseString(yamlString: String): Try[FallbackManifest] = {
    val snakeYaml = new org.yaml.snakeyaml.Yaml()
    Try(snakeYaml.compose(new StringReader(yamlString))).toEither
      .flatMap(implicitly[SnakeYamlDecoder[FallbackManifest]].decode(_))
      .toTry
  }
}
