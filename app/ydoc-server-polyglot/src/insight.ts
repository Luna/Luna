import { deserializeIdMap } from 'ydoc-server'
import * as Ast from 'ydoc-shared/ast'
import { splitFileContents } from 'ydoc-shared/ensoFile'
import { ModuleDoc } from 'ydoc-shared/yjsModel'
import * as Y from 'yjs'

print("Initializing Insight: " + JSON.stringify(insight));

const PROJECT_NAME = 'NewProject1'
const RETURN_VALUE_KEY = 'insight_return_value'

const doc = new ModuleDoc(new Y.Doc())
const syncModule = new Ast.MutableModule(doc.ydoc)
let spanMap = null

function parseContents(contents: string, syncModule: Ast.MutableModule) {
  const { code, idMapJson, metadataJson } = splitFileContents(contents)
  const parsedIdMap = deserializeIdMap(idMapJson)

  const { root, spans } = Ast.parseModuleWithSpans(code, syncModule)
  syncModule.setRoot(root)
  spanMap = spans

  Ast.setExternalIds(syncModule, spans, parsedIdMap)
  print(`[parseContents] idMap.entries=${parsedIdMap.entries()}`)
}

insight.on("source", function(ctx, frame) {
  print(`[source] ctx.uri=${ctx.name}`)
  if (ctx.name.includes(PROJECT_NAME)) {
    print(`[source] MATCHED ctx=${JSON.stringify(ctx)}`)
    parseContents(ctx.characters, syncModule)
  }
})

function resultToString(result: any): string {
  return '' + result;
}

/*
  class IdMap {
    private readonly rangeToExpr: Map<SourceRange, ExternalId>
  }
  interface SpanMap {
    nodes: Map<NodeKey, Ast[]>
    tokens: Map<TokenKey, Token>
  }
  type NodeKey = TokenKey = SourceRangeKey
 */
insight.on("return", function(ctx, frame) {
  print(`[return] ctx='${JSON.stringify(ctx)}'`)
  print(`[return] frame='${JSON.stringify(frame)}'`)
  print(`[return] ctx.returnValue='${ctx.returnValue(frame)}'`)

  const result = ctx.returnValue(frame)
  if (result && spanMap) {
    const key = Ast.nodeKey(ctx.charIndex, ctx.charEndIndex - ctx.charIndex)
    const asts = spanMap.nodes.get(key)
    if (asts) {
      const resultValue = resultToString(result)
      for (const ast of asts) {
        const editAst = syncModule.getVersion(ast)
        if (editAst.widgetMetadata(RETURN_VALUE_KEY) !== resultValue) {
          print(`[return] setWidgetMetadata ${ast.code()} : ${resultValue}`)
          editAst.setWidgetMetadata(RETURN_VALUE_KEY, resultValue)
        }
      }
    }
  }
}, {
  expressions: true,
  statements: false,
  roots: false,
  rootNameFilter: ".*main"
})
