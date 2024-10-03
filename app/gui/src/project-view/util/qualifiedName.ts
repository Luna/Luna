import {
  isIdentifier,
  isIdentifierOrOperatorIdentifier,
  type Identifier,
  type IdentifierOrOperatorIdentifier,
  type QualifiedName,
} from '@/util/ast/abstract'
import { Err, Ok, type Result } from '@/util/data/result'
export {
  isIdentifier,
  isIdentifierOrOperatorIdentifier,
  type Identifier,
  type IdentifierOrOperatorIdentifier,
  type QualifiedName,
}

const identifierRegexPart = '(?:(?:[a-zA-Z_][0-9]*)+|[!$%&*+,-./:;<=>?@\\^|~]+)'
const qnRegex = new RegExp(`^${identifierRegexPart}(?:\\.${identifierRegexPart})*$`)
const mainSegmentRegex = new RegExp(`^(${identifierRegexPart}\\.${identifierRegexPart})\\.Main`)

export function tryIdentifier(str: string): Result<Identifier> {
  return isIdentifier(str) ? Ok(str) : Err(`"${str}" is not a valid identifier`)
}

export function tryIdentifierOrOperatorIdentifier(
  str: string,
): Result<IdentifierOrOperatorIdentifier> {
  return isIdentifierOrOperatorIdentifier(str) ? Ok(str) : Err(`"${str}" is not a valid identifier`)
}

export function isQualifiedName(str: string): str is QualifiedName {
  return qnRegex.test(str)
}

export function tryQualifiedName(str: string): Result<QualifiedName> {
  return isQualifiedName(str) ? Ok(str) : Err(`"${str}" is not a valid qualified name`)
}

/** Normalize qualified name, removing `Main` module segment of a project if it is present. */
export function normalizeQualifiedName(name: QualifiedName): QualifiedName {
  return name.replace(mainSegmentRegex, '$1') as QualifiedName
}

/** The index of the `.` between the last segment and all other segments.
 * The start of the last segment is one higher than this index. */
export function qnLastSegmentIndex(name: QualifiedName) {
  return name.lastIndexOf('.')
}

/** Split the qualified name to parent and last segment (name). */
export function qnSplit(
  name: QualifiedName,
): [QualifiedName | null, IdentifierOrOperatorIdentifier] {
  const separator = qnLastSegmentIndex(name)
  const parent = separator > 0 ? (name.substring(0, separator) as QualifiedName) : null
  const lastSegment = name.substring(separator + 1) as IdentifierOrOperatorIdentifier
  return [parent, lastSegment]
}

/** Get the last segment of qualified name. */
export function qnLastSegment(name: QualifiedName): IdentifierOrOperatorIdentifier {
  const separator = qnLastSegmentIndex(name)
  return name.substring(separator + 1) as IdentifierOrOperatorIdentifier
}

/** Get the parent qualified name (without last segment) */
export function qnParent(name: QualifiedName): QualifiedName | null {
  const separator = qnLastSegmentIndex(name)
  return separator > 1 ? (name.substring(0, separator) as QualifiedName) : null
}

export function qnJoin(left: QualifiedName, right: QualifiedName): QualifiedName {
  return `${left}.${right}` as QualifiedName
}

export function qnFromSegments(segments: Iterable<IdentifierOrOperatorIdentifier>): QualifiedName {
  return [...segments].join('.') as QualifiedName
}

export function qnSegments(name: QualifiedName): IdentifierOrOperatorIdentifier[] {
  return name.split('.').map((segment) => segment as IdentifierOrOperatorIdentifier)
}

export function qnSlice(
  name: QualifiedName,
  start?: number | undefined,
  end?: number | undefined,
): Result<QualifiedName> {
  return tryQualifiedName(qnSegments(name).slice(start, end).join('.'))
}

/** Checks if given full qualified name is considered a top element of some project.
 *
 * The fully qualified names consists of namespace, project name, and then a path (possibly empty).
 * The element is considered a top element if there is max 1 segment in the path.
 */
export function qnIsTopElement(name: QualifiedName): boolean {
  return !/[.].*?[.].*?[.]/.test(name)
}

/**
 * Replace the project name in this qualified name if equal to `oldProject`, otherwise return `qn`.
 *
 * The namespace will be unchanged.
 */
export function qnReplaceProjectName(
  qn: QualifiedName,
  oldProject: string,
  newProject: Identifier,
): QualifiedName {
  return qn.replace(
    new RegExp(`^(${identifierRegexPart}\\.)${oldProject}(?=\\.|$)`),
    `$1${newProject}`,
  ) as QualifiedName
}
