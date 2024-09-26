import * as map from 'lib0/map'
import { assert, assertEqual } from '../util/assert'
import { nodeKey, SpanMap, tokenKey } from './idMap'
import { isTokenId, SyncTokenId, TokenType } from './token'
import { Ast, AstId, parentId } from './tree'

export type ConcreteChild<T> = { whitespace: string; node: T }
export type RawConcreteChild = ConcreteChild<AstId> | ConcreteChild<SyncTokenId>

export function spaced<T extends object | string>(node: T): ConcreteChild<T>
export function spaced<T extends object | string>(node: T | undefined): ConcreteChild<T> | undefined
export function spaced<T extends object | string>(
  node: T | undefined,
): ConcreteChild<T> | undefined {
  if (node === undefined) return node
  return { whitespace: ' ', node }
}

export function unspaced<T extends object | string>(node: T): ConcreteChild<T>
export function unspaced<T extends object | string>(
  node: T | undefined,
): ConcreteChild<T> | undefined
export function unspaced<T extends object | string>(
  node: T | undefined,
): ConcreteChild<T> | undefined {
  if (node === undefined) return node
  return { whitespace: '', node }
}

export interface OptionalWhitespace {
  whitespace?: string | undefined
}
export interface WithWhitespace extends OptionalWhitespace {
  whitespace: string
}
export function withWhitespace<T>(node: T, whitespace: string): T & WithWhitespace {
  return { ...node, whitespace }
}
export function ensureSpacedOnlyIf<T extends OptionalWhitespace>(
  child: T,
  condition: boolean,
  verbatim: boolean | undefined,
): T & WithWhitespace {
  return condition ? ensureSpaced(child, verbatim) : ensureUnspaced(child, verbatim)
}

export function isConcrete<T extends OptionalWhitespace>(child: T): child is T & WithWhitespace {
  return child.whitespace !== undefined
}
export function tryAsConcrete<T extends OptionalWhitespace>(
  child: T,
): (T & WithWhitespace) | undefined {
  return isConcrete(child) ? child : undefined
}
export function ensureSpaced<T extends OptionalWhitespace>(
  child: T,
  verbatim: boolean | undefined,
): T & WithWhitespace {
  const concreteInput = tryAsConcrete(child)
  if (verbatim && concreteInput) return concreteInput
  return concreteInput?.whitespace ? concreteInput : { ...child, whitespace: ' ' }
}
export function ensureUnspaced<T extends OptionalWhitespace>(
  child: T,
  verbatim: boolean | undefined,
): T & WithWhitespace {
  const concreteInput = tryAsConcrete(child)
  if (verbatim && concreteInput) return concreteInput
  return concreteInput?.whitespace === '' ? concreteInput : { ...child, whitespace: '' }
}
export function firstChild<T extends OptionalWhitespace>(child: T): T & WithWhitespace {
  const concreteInput = tryAsConcrete(child)
  return concreteInput?.whitespace === '' ? concreteInput : { ...child, whitespace: '' }
}
export function preferSpacedIf<T extends OptionalWhitespace>(
  child: T,
  condition: boolean,
): T & WithWhitespace {
  return condition ? preferSpaced(child) : preferUnspaced(child)
}
export function preferUnspaced<T extends OptionalWhitespace>(child: T): T & WithWhitespace {
  return tryAsConcrete(child) ?? { ...child, whitespace: '' }
}
export function preferSpaced<T extends OptionalWhitespace>(child: T): T & WithWhitespace {
  return tryAsConcrete(child) ?? { ...child, whitespace: ' ' }
}

/** Code with an associated mapping to `Ast` types. */
interface PrintedSource {
  info: SpanMap
  code: string
}

/** Return stringification with associated ID map. This is only exported for testing. */
export function printWithSpans(ast: Ast): PrintedSource {
  const info: SpanMap = {
    nodes: new Map(),
    tokens: new Map(),
  }
  const code = ast.printSubtree(info, 0, null)
  return { info, code }
}

/**
 * Used by `Ast.printSubtree`.
 * @internal
 */
export function printAst(
  ast: Ast,
  info: SpanMap,
  offset: number,
  parentIndent: string | null,
  verbatim: boolean = false,
): string {
  let code = ''
  let currentLineIndent = parentIndent
  let prevIsNewline = false
  let isFirstToken = offset === 0
  for (const child of ast.concreteChildren({ verbatim, indent: parentIndent })) {
    if (!isTokenId(child.node) && ast.module.get(child.node) === undefined) continue
    if (prevIsNewline) currentLineIndent = child.whitespace
    const token = isTokenId(child.node) ? ast.module.getToken(child.node) : undefined
    // Every line in a block starts with a newline token. In an AST produced by the parser, the newline token at the
    // first line of a module is zero-length. In order to handle whitespace correctly if the lines of a module are
    // rearranged, if a zero-length newline is encountered within a block, it is printed as an ordinary newline
    // character, and if an ordinary newline is found at the beginning of the output, it is not printed; however if the
    // output begins with a newline including a (plain) comment, we print the line as we would in any other block.
    if (
      token?.tokenType_ == TokenType.Newline &&
      isFirstToken &&
      (!token.code_ || token.code_ === '\n')
    ) {
      prevIsNewline = true
      isFirstToken = false
      continue
    }
    code += child.whitespace
    if (token) {
      const tokenStart = offset + code.length
      prevIsNewline = token.tokenType_ == TokenType.Newline
      let tokenCode = token.code_
      if (token.tokenType_ == TokenType.Newline) {
        tokenCode = tokenCode || '\n'
      }
      const span = tokenKey(tokenStart, tokenCode.length)
      info.tokens.set(span, token)
      code += tokenCode
    } else {
      assert(!isTokenId(child.node))
      prevIsNewline = false
      const childNode = ast.module.get(child.node)
      code += childNode.printSubtree(info, offset + code.length, currentLineIndent, verbatim)
      // Extra structural validation.
      assertEqual(childNode.id, child.node)
      if (parentId(childNode) !== ast.id) {
        console.error(`Inconsistent parent pointer (expected ${ast.id})`, childNode)
      }
      assertEqual(parentId(childNode), ast.id)
    }
    isFirstToken = false
  }
  // Adjustment to handle an edge case: A module starts with a zero-length newline token. If its first line is indented,
  // the initial whitespace belongs to the first line because it isn't hoisted past the (zero-length) newline to be the
  // leading whitespace for the block. In that case, our representation of the block contains leading whitespace at the
  // beginning, which must be excluded when calculating spans.
  const leadingWhitespace = code.match(/ */)?.[0].length ?? 0
  const span = nodeKey(offset + leadingWhitespace, code.length - leadingWhitespace)
  map.setIfUndefined(info.nodes, span, (): Ast[] => []).unshift(ast)
  return code
}
