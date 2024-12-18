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
    renameFunc: String => Option[String]
  ): Unit = {
    Using(new JarFile(inputJarPath.toFile)) { inputJar =>
      Using(new JarOutputStream(Files.newOutputStream(outputJarPath))) {
        outputJar =>
          inputJar.stream().forEach { entry =>
            if (entry.getName.startsWith(extractPrefix) && !entry.isDirectory) {
              renameFunc(entry.getName) match {
                case Some(strippedEntryName) =>
                  assert(!strippedEntryName.startsWith("/"))
                  val destFile = extractedFilesDir.resolve(strippedEntryName)
                  Files.createDirectories(destFile.getParent)
                  Using(inputJar.getInputStream(entry)) { is =>
                    Files.copy(is, destFile)
                  }
                case None => ()
              }
            } else {
              outputJar.putNextEntry(new JarEntry(entry.getName))
              Using(inputJar.getInputStream(entry)) { is =>
                is.transferTo(outputJar)
              }
              outputJar.closeEntry()
            }
          }
      }
    }
  }
}
