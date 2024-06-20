package org.enso.editions

import io.circe.syntax.EncoderOps
import io.circe.{Decoder, DecodingFailure, Encoder}
import org.enso.yaml.SnakeYamlDecoder
import org.yaml.snakeyaml.error.YAMLException
import org.yaml.snakeyaml.nodes.{MappingNode, Node}

/** Represents a library name that should uniquely identify the library.
  *
  * @param namespace library's namespace - either a special reserved prefix or
  *                  the username of the main author
  * @param name library's name
  */
case class LibraryName(namespace: String, name: String) {

  /** The qualified name of the library consists of its prefix and name
    * separated with a dot.
    */
  def qualifiedName: String = s"$namespace${LibraryName.separator}$name"

  /** @inheritdoc */
  override def toString: String = qualifiedName
}

object LibraryName {

  object Fields {
    val Namespace = "namespace"
    val Email     = "email"
  }

  implicit val yamlDecoder: SnakeYamlDecoder[LibraryName] =
    new SnakeYamlDecoder[LibraryName] {
      override def decode(node: Node): Either[Throwable, LibraryName] =
        node match {
          case mappingNode: MappingNode =>
            val stringDecoder = implicitly[SnakeYamlDecoder[String]]

            if (mappingNode.getValue.size() != 2)
              Left(new YAMLException("invalid number of fields for Contact"))
            else {
              val clazzMap = mappingKV(mappingNode)
              val result = for {
                namesapce <- clazzMap
                  .get(Fields.Namespace)
                  .toRight(
                    new YAMLException(s"Missing '${Fields.Namespace}' field")
                  )
                  .flatMap(stringDecoder.decode)
                email <- clazzMap
                  .get(Fields.Email)
                  .toRight(
                    new YAMLException(s"Missing '${Fields.Email}' field")
                  )
                  .flatMap(stringDecoder.decode)
              } yield LibraryName(namesapce, email)
              result
            }
        }
    }

  /** A [[Decoder]] instance allowing to parse a [[LibraryName]]. */
  implicit val decoder: Decoder[LibraryName] = { json =>
    for {
      str <- json.as[String]
      name <- fromString(str).left.map { errorMessage =>
        DecodingFailure(errorMessage, json.history)
      }
    } yield name
  }

  implicit val encoder: Encoder[LibraryName] = { libraryName =>
    libraryName.toString.asJson
  }

  val separator = '.'

  /** Creates a [[LibraryName]] from its string representation.
    *
    * Returns an error message on failure.
    */
  def fromString(str: String): Either[String, LibraryName] = {
    str.split(separator) match {
      case Array(namespace, name) => Right(LibraryName(namespace, name))
      case _                      => Left(s"`$str` is not a valid library name.")
    }
  }

  /** Extracts the [[LibraryName]] from a full name of a module. */
  def fromModuleName(module: String): Option[LibraryName] =
    module.split(separator) match {
      case Array(namespace, name, _ @_*) => Some(LibraryName(namespace, name))
      case _                             => None
    }
}
