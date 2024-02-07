import { parseEnso } from '@/util/ast'
import { swapKeysAndValues, unsafeEntries } from '@/util/record'
import type { AstId, MutableAst, NodeKey, Owned, TokenId, TokenKey } from 'shared/ast'
import {
  Ast,
  BodyBlock,
  Function,
  MutableBodyBlock,
  MutableModule,
  Token,
  abstract,
  isTokenId,
  print,
} from 'shared/ast'
export * from 'shared/ast'

const mapping: Record<string, string> = {
  '\b': '\\b',
  '\f': '\\f',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '\v': '\\v',
  '"': '\\"',
  "'": "\\'",
  '`': '``',
}

const reverseMapping = swapKeysAndValues(mapping)

/** Escape a string so it can be safely spliced into an interpolated (`''`) Enso string.
 * NOT USABLE to insert into raw strings. Does not include quotes. */
export function escape(string: string) {
  return string.replace(/[\0\b\f\n\r\t\v"'`]/g, (match) => mapping[match]!)
}

/** The reverse of `escape`: transform the string into human-readable form, not suitable for interpolation. */
export function unescape(string: string) {
  return string.replace(/\\[0bfnrtv"']|``/g, (match) => reverseMapping[match]!)
}

export function deserialize(serialized: string): Owned {
  const parsed: SerializedPrintedSource = JSON.parse(serialized)
  const nodes = new Map(unsafeEntries(parsed.info.nodes))
  const tokens = new Map(unsafeEntries(parsed.info.tokens))
  const module = MutableModule.Transient()
  const tree = parseEnso(parsed.code)
  const ast = abstract(module, tree, parsed.code)
  // TODO: ast <- nodes,tokens
  return ast.root
}

interface SerializedInfoMap {
  nodes: Record<NodeKey, AstId[]>
  tokens: Record<TokenKey, TokenId>
}

interface SerializedPrintedSource {
  info: SerializedInfoMap
  code: string
}

export function serialize(ast: Ast): string {
  return JSON.stringify(print(ast))
}

export type TokenTree = (TokenTree | string)[]
export function tokenTree(root: Ast): TokenTree {
  const module = root.module
  return Array.from(root.concreteChildren(), (child) => {
    if (isTokenId(child.node)) {
      return module.getToken(child.node).code()
    } else {
      const node = module.get(child.node)
      return node ? tokenTree(node) : '<missing>'
    }
  })
}

export function tokenTreeWithIds(root: Ast): TokenTree {
  const module = root.module
  return [
    root.externalId,
    ...Array.from(root.concreteChildren(), (child) => {
      if (isTokenId(child.node)) {
        return module.getToken(child.node).code()
      } else {
        const node = module.get(child.node)
        return node ? tokenTreeWithIds(node) : ['<missing>']
      }
    }),
  ]
}

export function moduleMethodNames(topLevel: BodyBlock): Set<string> {
  const result = new Set<string>()
  for (const statement of topLevel.statements()) {
    const inner = statement.innerExpression()
    if (inner instanceof Function) {
      result.add(inner.name.code())
    }
  }
  return result
}

// FIXME: We should use alias analysis to handle ambiguous names correctly.
export function findModuleMethod(topLevel: BodyBlock, name: string): Function | undefined {
  for (const statement of topLevel.statements()) {
    const inner = statement.innerExpression()
    if (inner instanceof Function && inner.name.code() === name) {
      return inner
    }
  }
  return undefined
}

export function functionBlock(topLevel: BodyBlock, name: string) {
  const func = findModuleMethod(topLevel, name)
  if (!(func?.body instanceof BodyBlock)) return undefined
  return func.body
}

export function deleteFromParentBlock(ast: MutableAst) {
  const parent = ast.mutableParent()
  if (parent instanceof MutableBodyBlock)
    parent.updateLines((lines) => lines.filter((line) => line.expression?.node.id !== ast.id))
}

declare const tokenKey: unique symbol
declare module '@/providers/widgetRegistry' {
  export interface WidgetInputTypes {
    [tokenKey]: Token
  }
}
