import { deserializeIdMap } from 'ydoc-server'
import * as Ast from 'ydoc-shared/ast'
import { splitFileContents } from 'ydoc-shared/ensoFile'
import { DistributedProject, ModuleDoc } from 'ydoc-shared/yjsModel'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

interface SubdocsEvent {
  loaded: Set<Y.Doc>
  added: Set<Y.Doc>
  removed: Set<Y.Doc>
}

print("Initializing Insight: " + JSON.stringify(insight));

const PROJECT_NAME = 'NewProject1'
const RETURN_VALUE_KEY = 'insight_return_value'

//const doc = new ModuleDoc(new Y.Doc())
const doc = new Y.Doc()
const syncModule = new Ast.MutableModule(doc)
let spanMap = null

function attachProvider(url: string, room: string, doc: Y.Doc) {
  print(`attachProvider ${url} ${room}`)
  const provider = new WebsocketProvider(url, room, doc)
  const onSync = () => doc.emit('sync', [true, doc])
  const onDrop = () => doc.emit('sync', [false, doc])

  const attachedSubdocs = new Map<Y.Doc, ReturnType<typeof attachProvider>>()

  function onSubdocs(e: SubdocsEvent) {
    e.loaded.forEach((subdoc) => {
      attachedSubdocs.set(subdoc, attachProvider(url, subdoc.guid, subdoc))
    })
    e.removed.forEach((subdoc) => {
      const subdocProvider = attachedSubdocs.get(subdoc)
      attachedSubdocs.delete(subdoc)
      if (subdocProvider != null) {
        subdocProvider.dispose()
      }
    })
  }

  provider.on('sync', onSync)
  provider.on('connection-close', onDrop)
  provider.on('connection-error', onDrop)
  doc.on('subdocs', onSubdocs)

  function dispose() {
    provider.disconnect()
    provider.off('sync', onSync)
    provider.off('connection-close', onDrop)
    provider.off('connection-error', onDrop)
    doc.off('subdocs', onSubdocs)
    attachedSubdocs.forEach((subdocProvider) => {
      subdocProvider.dispose()
    })
  }
  return { provider, dispose }
}

const d = new Y.Doc()
const project = new DistributedProject(d)
//const provider = attachProvider('ws://[::1]:5976/project', 'index', d)

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

  const p = project
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
