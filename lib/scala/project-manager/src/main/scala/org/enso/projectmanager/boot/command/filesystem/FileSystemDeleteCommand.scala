package org.enso.projectmanager.boot.command.filesystem

import org.enso.projectmanager.boot.configuration.ProjectManagerConfig
import org.enso.projectmanager.control.core.syntax._
import org.enso.projectmanager.control.core.{Applicative, CovariantFlatMap}
import org.enso.projectmanager.control.effect.{ErrorChannel, Sync}
import org.enso.projectmanager.infrastructure.desktop.DesktopTrash
import org.enso.projectmanager.infrastructure.file.BlockingFileSystem
import org.enso.projectmanager.infrastructure.random.SystemGenerator
import org.enso.projectmanager.infrastructure.repository.ProjectFileRepositoryFactory
import org.enso.projectmanager.infrastructure.time.RealClock
import org.enso.projectmanager.protocol.FileSystemManagementApi.FileSystemDeleteDirectory
import org.enso.projectmanager.service.filesystem.{
  FileSystemService,
  FileSystemServiceApi,
  FileSystemServiceFailure
}

import java.io.File

final class FileSystemDeleteCommand[F[+_, +_]: CovariantFlatMap](
  service: FileSystemServiceApi[F],
  path: File
) {

  def run: F[FileSystemServiceFailure, FileSystemDeleteDirectory.Result] =
    service.delete(path).map(_ => FileSystemDeleteDirectory.Result)
}

object FileSystemDeleteCommand {

  def apply[F[+_, +_]: Applicative: CovariantFlatMap: ErrorChannel: Sync](
    config: ProjectManagerConfig,
    path: File
  ): FileSystemDeleteCommand[F] = {
    val clock      = new RealClock[F]
    val fileSystem = new BlockingFileSystem[F](config.timeout.ioTimeout)
    val gen        = new SystemGenerator[F]
    val trash      = DesktopTrash[F]

    val projectRepositoryFactory =
      new ProjectFileRepositoryFactory[F](
        config.storage,
        clock,
        fileSystem,
        gen,
        trash
      )

    val service = new FileSystemService[F](fileSystem, projectRepositoryFactory)

    new FileSystemDeleteCommand[F](service, path)
  }
}
