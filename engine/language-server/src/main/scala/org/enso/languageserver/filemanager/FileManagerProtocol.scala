package org.enso.languageserver.filemanager

import java.io.File
import java.util.UUID

object FileManagerProtocol {

  /** Transfer object containing textual contents of the file with its path.
    *
    * @param path a path to a file
    * @param content the textual contents
    */
  case class TextualFileContent(path: File, content: String)

  /** Transfer object containing binary contents of the file with its path.
    *
    * @param path a path to a file
    * @param contents the binary contents
    */
  case class BinaryFileContent(path: File, contents: Array[Byte])

  /** Gets all content roots.
    */
  case object GetContentRoots

  /** Response containing all content roots.
    *
    * @param contentRoots content roots
    */
  case class ContentRootsResult(contentRoots: Set[UUID])

  /** Requests the Language Server write textual content to an arbitrary file.
    *
    * @param path a path to a file
    * @param content a textual content
    */
  case class WriteFile(path: Path, content: String)

  /** Requests the Language Server write binary contents to an arbitrary file.
    *
    * @param path a path to a file
    * @param contents binary contents
    */
  case class WriteBinaryFile(path: Path, contents: Array[Byte])

  /** Signals file manipulation status.
    *
    * @param result either file system failure or unit representing success
    */
  case class WriteFileResult(result: Either[FileSystemFailure, Unit])

  /** Requests the Language Server read a file.
    *
    * @param path a path to a file
    */
  case class ReadFile(path: Path)

  /** Requests the Language Server to read a binary content of a file.
    *
    * @param path a path to a file
    */
  case class ReadBinaryFile(path: Path)

  /** Returns a result of reading a file.
    *
    * @param result either file system failure or content of a file
    */
  case class ReadTextualFileResult(
    result: Either[FileSystemFailure, TextualFileContent]
  )

  /** Returns a result of reading binary contents of a file.
    *
    * @param result either file system failure or content of a file
    */
  case class ReadBinaryFileResult(
    result: Either[FileSystemFailure, BinaryFileContent]
  )

  /** Requests the Language Server create a file system object.
    *
    * @param `object` a file system object
    */
  case class CreateFile(`object`: FileSystemObject)

  /** Returns a result of creating a file system object.
    *
    * @param result either file system failure or unit representing success
    */
  case class CreateFileResult(result: Either[FileSystemFailure, Unit])

  /** Requests the Language Server delete a file system object.
    *
    * @param path a path to a file
    */
  case class DeleteFile(path: Path)

  /** Returns a result of deleting a file system object.
    *
    * @param result either file system failure or unit representing success
    */
  case class DeleteFileResult(result: Either[FileSystemFailure, Unit])

  /** Requests the Language Server copy a file system object.
    *
    * @param from a path to the source
    * @param to a path to the destination
    */
  case class CopyFile(from: Path, to: Path)

  /** Returns a result of copying a file system object.
    *
    * @param result either file system failure or unit representing success
    */
  case class CopyFileResult(result: Either[FileSystemFailure, Unit])

  /** Requests the Language Server move a file system object.
    *
    * @param from a path to the source
    * @param to a path to the destination
    */
  case class MoveFile(from: Path, to: Path)

  /** Returns a result of moving a file system object.
    *
    * @param result either file system failure or unit representing success
    */
  case class MoveFileResult(result: Either[FileSystemFailure, Unit])

  /** Requests the Language Server to check the existence of file system object.
    *
    * @param path a path to a file
    */
  case class ExistsFile(path: Path)

  /** Returns a result of checking the existence of file system object.
    *
    * @param result either file system failure or file existence flag
    */
  case class ExistsFileResult(result: Either[FileSystemFailure, Boolean])

  /** Requests the Language Server to list a directory contents.
    *
    * @param path to the file system object
    */
  case class ListFile(path: Path)

  /** Returns a tree representation of a file system object.
    *
    * @param result either file system failure or directory tree
    */
  case class ListFileResult(
    result: Either[FileSystemFailure, Vector[FileSystemObject]]
  )

  /** Requests the Language Server to get a tree of a file system object.
    *
    * @param path to the file system object
    */
  case class TreeFile(path: Path, depth: Option[Int])

  /** Returns a tree representation of a file system object.
    *
    * @param result either file system failure or directory tree
    */
  case class TreeFileResult(result: Either[FileSystemFailure, DirectoryTree])

  /** Requests the Language Server to get attributes of a file system object.
    *
    * @param path to the file system object
    */
  case class InfoFile(path: Path)

  /** Returns an attributes of a file system object.
    *
    * @param result either file system failure or attributes
    */
  case class InfoFileResult(result: Either[FileSystemFailure, FileAttributes])

  /** Requests that the Language Server provide the checksum of the specified
    * file system object
    *
    * @param path to the file system object
    */
  case class ChecksumFileRequest(path: Path)

  /** Returns the checksum of the file system object in question.
    *
    * @param checksum either a FS failure or the checksum as a base64-encoded
    *                 string
    */
  case class ChecksumFileResponse(checksum: Either[FileSystemFailure, String])

  case class ChecksumBytesRequest(segment: Data.FileSegment)

  case class ChecksumBytesResponse(
    checksum: Either[FileSystemFailure, Array[Byte]]
  )

  /** Data-types for the file management protocol. */
  object Data {

    /** A representation of a segment in the file.
      *
      * @param path the path to the file in question
      * @param byteOffset the byte offset in the file to start from
      * @param length the number of bytes in the segment
      */
    case class FileSegment(path: Path, byteOffset: Long, length: Long)
  }
}
