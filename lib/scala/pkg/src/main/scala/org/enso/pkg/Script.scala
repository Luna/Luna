package org.enso.pkg

import io.circe.{Decoder, DecodingFailure, Encoder, Json}
import org.enso.scala.yaml.{YamlDecoder, YamlEncoder}
import org.yaml.snakeyaml.error.YAMLException
import org.yaml.snakeyaml.nodes.{MappingNode, Node, ScalarNode, SequenceNode}

import java.util

case class Script(name: String, arguments: Seq[String])

object Script {

  /** [[Encoder]] instance for the [[Script]]. */
  implicit val encoder: Encoder[Script] = { script =>
    val vs = script.arguments.map(Json.fromString)
    Json.obj(script.name -> Json.arr(vs: _*))
  }

  implicit val yamlEncoder: YamlEncoder[Script] =
    new YamlEncoder[Script] {
      override def encode(value: Script) = {
        val fields = new util.ArrayList[String](value.arguments.length)
        value.arguments.foreach(v => fields.add(v))
        toMap(value.name, fields)
      }
    }

  /** [[Decoder]] instance for the [[Script]]. */
  implicit val decoder: Decoder[Script] = { json =>
    for {
      key    <- json.key.toRight(DecodingFailure("no key", Nil))
      fields <- json.get[List[String]](key)
    } yield Script(key, fields)
  }

  implicit val yamlDecoder: YamlDecoder[Script] =
    new YamlDecoder[Script] {
      override def decode(node: Node): Either[Throwable, Script] =
        node match {
          case mappingNode: MappingNode =>
            if (mappingNode.getValue.size() == 1) {
              val groupNode = mappingNode.getValue.get(0)
              (groupNode.getKeyNode, groupNode.getValueNode) match {
                case (scalarNode: ScalarNode, seqNode: SequenceNode) =>
                  val stringDecoder = implicitly[YamlDecoder[String]]
                  val valuesDecoder = implicitly[YamlDecoder[Seq[String]]]

                  for {
                    k  <- stringDecoder.decode(scalarNode)
                    vs <- valuesDecoder.decode(seqNode)
                  } yield Script(k, vs)
                case _ =>
                  Left(
                    new YAMLException(
                      "Failed to decode script. Expected a map field"
                    )
                  )
              }
            } else {
              Left(
                new YAMLException("Failed to decode script")
              )
            }
        }
    }

}
