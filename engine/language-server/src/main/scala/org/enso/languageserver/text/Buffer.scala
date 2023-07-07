package org.enso.languageserver.text

import java.io.File
import org.enso.text.{ContentBasedVersioning, ContentVersion}
import org.enso.text.buffer.Rope
import org.enso.text.editing.model.Position
import org.enso.text.editing.model.Range

import java.time.OffsetDateTime

/** A buffer state representation.
  *
  * @param fileWithMetadata the file linked to the buffer.
  * @param contents the contents of the buffer.
  * @param inMemory determines if the buffer is in-memory
  * @param version the current version of the buffer contents.
  */
case class Buffer(
  fileWithMetadata: FileWithMetadata,
  contents: Rope,
  inMemory: Boolean,
  version: ContentVersion
) {

  /** Returns a range covering the whole buffer. */
  lazy val fullRange: Range = {
    val lines = contents.lines.length
    Range(
      Position(0, 0),
      Position(lines - 1, contents.lines.drop(lines - 1).characters.length)
    )
  }

  def withContents(
    newContents: Rope,
    inMemory: Boolean = inMemory
  )(implicit versionCalculator: ContentBasedVersioning): Buffer =
    copy(
      contents = newContents,
      version  = versionCalculator.evalVersion(newContents.toString),
      inMemory = inMemory
    )

  def withLastModifiedTime(lastModifiedTime: OffsetDateTime): Buffer =
    copy(
      fileWithMetadata =
        fileWithMetadata.copy(lastModifiedTime = Some(lastModifiedTime))
    )
}

object Buffer {

  /** Creates a new buffer with a freshly generated version.
    *
    * @param file the file linked to the buffer.
    * @param contents the contents of this buffer.
    * @param inMemory determines if the buffer is in-memory
    * @param versionCalculator a digest calculator for content based versioning.
    * @return a new buffer instance.
    */
  def apply(
    file: File,
    contents: String,
    inMemory: Boolean
  )(implicit versionCalculator: ContentBasedVersioning): Buffer =
    Buffer(
      FileWithMetadata(file),
      Rope(contents),
      inMemory,
      versionCalculator.evalVersion(contents)
    )
}
