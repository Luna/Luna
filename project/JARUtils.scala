import java.io.IOException
import java.nio.file.{Files, Path}
import java.util.jar.{JarEntry, JarFile, JarOutputStream}
import scala.util.{Try, Using}

object JARUtils {

  /** Extracts all file entries starting with `extractPrefix` from `inputJarPath` to `extractedFilesDir`,
    * optionally renaming them with `renameFunc`.
    * The rest is copied into `outputJarPath`.
    *
    * @param inputJarPath      Path to the JAR archive. Will not be modified.
    * @param extractPrefix     Prefix of the files to extract.
    * @param outputJarPath     Path to the output JAR. Input JAR will be copied here without the files
    *                          starting with `extractPrefix`.
    * @param extractedFilesDir Destination directory for the extracted files. The prefix from the
    *                          extracted files is tripped.
    * @param renameFunc        Function that renames the extracted files. The extracted file name is taken
    *                          from the jar entry, and thus may contain slashes. If None is returned, the
    *                          file is ignored and not extracted.
    */
  def extractFilesFromJar(
    inputJarPath: Path,
    extractPrefix: String,
    outputJarPath: Path,
    extractedFilesDir: Path,
    renameFunc: String => Option[String],
    logger: sbt.util.Logger
  ): Unit = {
    ensureDirExists(outputJarPath.getParent, logger)
    ensureDirExists(extractedFilesDir, logger)
    Using(new JarFile(inputJarPath.toFile)) { inputJar =>
      Using(new JarOutputStream(Files.newOutputStream(outputJarPath))) {
        outputJar =>
          inputJar.stream().forEach { entry =>
            if (entry.getName.startsWith(extractPrefix) && !entry.isDirectory) {
              renameFunc(entry.getName) match {
                case Some(strippedEntryName) =>
                  assert(!strippedEntryName.startsWith("/"))
                  assert(extractedFilesDir.toFile.exists)
                  val destFile = extractedFilesDir.resolve(strippedEntryName)
                  if (!destFile.getParent.toFile.exists) {
                    Files.createDirectories(destFile.getParent)
                  }
                  Using(inputJar.getInputStream(entry)) { is =>
                    Files.copy(is, destFile)
                  }.recover({ case e: IOException =>
                    logger.err(
                      s"Failed to extract $entry to $destFile: ${e.getMessage}"
                    )
                    e.printStackTrace(System.err)
                  })
                case None => ()
              }
            } else {
              outputJar.putNextEntry(new JarEntry(entry.getName))
              Using(inputJar.getInputStream(entry)) { is =>
                is.transferTo(outputJar)
              }.recover({ case e: IOException =>
                logger.err(
                  s"Failed to copy $entry to output JAR: ${e.getMessage}"
                )
                e.printStackTrace(System.err)
              })
              outputJar.closeEntry()
            }
          }
      }.recover({ case e: IOException =>
        logger.err(
          s"Failed to create output JAR at $outputJarPath: ${e.getMessage}"
        )
        e.printStackTrace(System.err)
      })
    }.recover({ case e: IOException =>
      logger.err(
        s"Failed to extract files from $inputJarPath to $extractedFilesDir: ${e.getMessage}"
      )
      e.printStackTrace(System.err)
    })
  }

  private def ensureDirExists(
    path: Path,
    logger: sbt.util.Logger
  ): Unit = {
    if (path != null) {
      try {
        Files.createDirectories(path)
      } catch {
        case e: IOException =>
          logger.err(
            s"Failed to create parent directories for $path: ${e.getMessage}"
          )
          e.printStackTrace(System.err)
      }
    }
  }
}
