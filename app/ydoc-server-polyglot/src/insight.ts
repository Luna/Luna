import { deserializeIdMap } from 'ydoc-server'
import * as Ast from 'ydoc-shared/ast'
import { splitFileContents } from 'ydoc-shared/ensoFile'
import { ModuleDoc } from 'ydoc-shared/yjsModel'
import * as Y from 'yjs'

print("Initializing Insight: " + JSON.stringify(insight));

const PROJECT_NAME = 'NewProject1'
const doc = new ModuleDoc(new Y.Doc());
const syncModule = new Ast.MutableModule(doc.ydoc)

function parseContents(contents: string, syncModule: Ast.MutableModule) {
  const { code, idMapJson, metadataJson } = splitFileContents(contents)
  const parsedIdMap = deserializeIdMap(idMapJson)

  const { root, spans } = Ast.parseModuleWithSpans(code, syncModule)
  syncModule.setRoot(root)

  Ast.setExternalIds(syncModule, spans, parsedIdMap)
  print(`[parseContents] idMap.entries=${parsedIdMap.entries()}`)
}

insight.on("source", function(ctx, frame) {
  print(`[source] ctx.uri=${ctx.name}`)
  if (ctx.name.includes(PROJECT_NAME)) {
    print(`[source] MATCHED ctx=${JSON.stringify(ctx)}`)
    parseContents(ctx.characters, syncModule)
  }
});

insight.on("return", function(ctx, frame) {
  print(`[return] ctx='${JSON.stringify(ctx)}'`)
  print(`[return] frame='${JSON.stringify(frame)}'`)
}, {
  expressions: false,
  statements: true,
  roots: false,
  rootNameFilter: ".*main"
});
