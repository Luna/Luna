/** @file Functions for manipulating and querying paths. */
import { isOnWindows } from '../detect'
import { newtypeConstructor, type Newtype } from './newtype'

/** A filesystem path. */
export type Path = Newtype<string, 'Path'>
/** Create a {@link Path}. */
export const Path = newtypeConstructor<Path>()

/** Construct a {@link Path} from an existing {@link Path} of the parent directory. */
export function joinPath(directoryPath: Path, fileName: string) {
  return Path(`${directoryPath}/${fileName}`)
}

/** Return the path, with backslashes (on Windows only) normalized to forward slashes. */
export function normalizeSlashes(path: string): Path {
  if (isOnWindows()) {
    return Path(path.replace(/\\/g, '/'))
  } else {
    return Path(path)
  }
}

/** Split a {@link Path} inito the path of its parent directory, and its file name. */
export function getDirectoryAndName(path: Path) {
  const [, directoryPath = '', fileName = ''] = path.match(/^(.+)[/]([^/]+)$/) ?? []
  return { directoryPath: Path(directoryPath), fileName }
}
