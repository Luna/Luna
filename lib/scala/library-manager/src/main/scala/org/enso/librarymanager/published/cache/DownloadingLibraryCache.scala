package org.enso.librarymanager.published.cache
import com.typesafe.scalalogging.Logger
import nl.gn0s1s.bump.SemVer
import org.enso.cli.task.ProgressReporter
import org.enso.distribution.FileSystem
import org.enso.distribution.locking.{
  LockType,
  LockUserInterface,
  ResourceManager
}
import org.enso.downloader.http.{HTTPDownload, URIBuilder}
import org.enso.editions.{Editions, LibraryName, LibraryVersion}
import org.enso.librarymanager.published.repository.LibraryManifest
import org.enso.librarymanager.published.repository.RepositoryHelper.{
  manifestFilename,
  RepositoryMethods
}
import org.enso.logger.masking.MaskedPath
import org.enso.yaml.YamlHelper

import java.nio.file.{Files, Path}
import scala.util.{Success, Try}

/** A [[LibraryCache]] that will try to download missing libraries.
  *
  * @param cacheRoot
  * @param temporaryDirectoryRoot
  * @param resourceManager
  * @param lockUserInterface
  * @param progressReporter
  */
class DownloadingLibraryCache(
  cacheRoot: Path,
  temporaryDirectoryRoot: Path,
  resourceManager: ResourceManager,
  lockUserInterface: LockUserInterface,
  progressReporter: ProgressReporter
) extends LibraryCache {
  private val logger = Logger[DownloadingLibraryCache]

  /** @inheritdoc */
  override def findCachedLibrary(
    libraryName: LibraryName,
    version: SemVer
  ): Option[Path] = {
    val path = LibraryCache.resolvePath(cacheRoot, libraryName, version)
    resourceManager.withResource(
      lockUserInterface,
      LibraryResource(libraryName, version),
      LockType.Shared
    ) {
      if (Files.isDirectory(path)) {
        logger.trace(
          s"Library [$libraryName:$version] found cached at " +
          s"[${MaskedPath(path).applyMasking()}]."
        )
        Some(path)
      } else None
    }
  }

  /** @inheritdoc */
  override def findOrInstallLibrary(
    libraryName: LibraryName,
    version: SemVer,
    recommendedRepository: Editions.Repository
  ): Try[Path] = {
    val _      = progressReporter // TODO
    val cached = findCachedLibrary(libraryName, version)
    cached match {
      case Some(result) => Success(result)
      case None =>
        installLibrary(libraryName, version, recommendedRepository)
    }
  }

  private def installLibrary(
    libraryName: LibraryName,
    version: SemVer,
    recommendedRepository: Editions.Repository
  ): Try[Path] = Try {
    logger.trace(s"Trying to install [$libraryName:$version].")
    resourceManager.withResource(
      lockUserInterface,
      LibraryResource(libraryName, version),
      LockType.Shared
    ) {
      val path = LibraryCache.resolvePath(cacheRoot, libraryName, version)
      if (Files.exists(path)) {
        logger.info(
          s"Another process has just installed [$libraryName:$version]."
        )
        Success(path)
      } else {
        val access           = recommendedRepository.accessLibrary(libraryName, version)
        val manifestDownload = access.downloadManifest()
        progressReporter.trackProgress(
          s"Downloading library manifest of [$libraryName].",
          manifestDownload
        )
        val manifest = manifestDownload.force()
        // See [Temporary Directories for Installation]
        FileSystem.withTemporaryDirectory(s"enso-$libraryName") {
          globalTmpDir =>
            // TODO download and install
            ???
        }
      }
    }
  }

  private def shouldDownloadArchive(archiveName: String): Boolean = {
    val isTestData = archiveName.startsWith("tests")
    !isTestData
  }

  override def preinstallLibrary(
    libraryName: LibraryName,
    version: SemVer,
    recommendedRepository: Editions.Repository,
    dependencyResolver: LibraryName => Option[LibraryVersion]
  ): Try[Unit] = {
    logger.warn("Predownloading dependencies is not yet implemented.")
    val _ = dependencyResolver
    findOrInstallLibrary(libraryName, version, recommendedRepository)
      .map(_ => ())
  }
}

/* Note [Library Cache Concurrency Model]
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * The library cache may be used by multiple instances of the engine and other
 * tools running concurrently and so it needs to handle concurrent access
 * scenarios.
 *
 * Currently our tools do not provide a way to uninstall libraries from the
 * cache, which will simplify the logic significantly, in the future it may be
 * extended to allow for clearing the cache. (Currently the user can just
 * manually clean the cache directory when no instances are running.)
 *
 * Thanks to the mentioned assumption, once a library is present in the cache,
 * we can assume that it will not disappear, so we do not need to synchronize
 * read access. The only thing that needs to be synchronized is installing
 * libraries - to make sure that if two processes try to install the same
 * library, only one of them actually performs the action. We also need to be
 * sure that when one process checks if the library exists, and if another
 * process is in the middle of installing it, it will not yet report it as
 * existing (as this could lead to loading an only-partially installed library).
 * The primary way of ensuring that will be to install the libraries to a
 * temporary cache directory next to the true cache and atomically move it at
 * the end of the operation. However as we do not have real guarantees that the
 * filesystem move is atomic (although most of the time it should be if it is
 * within a single filesystem), we will use locking to ensure consistency.
 * Obviously, every client that tries to install a library will acquire a write
 * lock for it, so that only one client is actually installing; but also every
 * client checking for the existence of the library will briefly acquire a read
 * lock for that library - thus if the library is currently being installed, the
 * client will need to wait for this read lock until the library installation is
 * finished and so will never encounter it in a 'partially installed' state. If
 * the library is not installed, the client can release the read lock and
 * re-acquire the write lock to try to install it. After acquiring the write
 * lock, it should check again if the library is available, to make sure that no
 * other process installed it in the meantime. This solution is efficient
 * because every library is locked independently and read locks can be acquired
 * by multiple clients at the same time, so the synchronization overhead for
 * already installed libraries is negligible, and for libraries that need to be
 * installed it is too negligible in comparison to the time required to download
 * the libraries.
 *
 * A single LockManager (and its locks directory) should be associated with at
 * most one library cache directory, as it makes sense for the distribution to
 * have only one cache, so the lock entries are not disambiguated in any way.
 */

/* Note [Temporary Directories for Installation]
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * When installing libraries (however the system is very similar for engines and
 * runtimes too), we extract the files to a temporary directory, to minimize the
 * risk of another process seeing a library in an invalid semi-installed state.
 * To achieve that, we extract the archives into a temporary directory that
 * resides next to the actual libraries directory, to ensure that they are on
 * the same disk partition - this way, after the extraction is complete, the
 * move from the temporary location to the final location is likely to be
 * atomic. (However even if the move is not atomic, everything should be
 * correct, as we also use file locks.)
 *
 * The temporary directory that is next to the destination directory is called
 * local temporary directory.
 *
 * However we also need a place to download the archives too, and as this place
 * does not necessarily need to be on the same partition as the destination, we
 * can use the default system-provided temporary directory. This one is called
 * the global temporary directory. The benefit of using it is that it is usually
 * automatically cleaned by the OS, so we do not need to be as careful about
 * cleanup in failure scenarios as with the local temporary directory.
 */
