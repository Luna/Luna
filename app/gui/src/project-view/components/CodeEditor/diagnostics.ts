import { type GraphStore } from '@/stores/graph'
import { type ProjectStore } from '@/stores/project'
import { type Diagnostic, forceLinting, linter } from '@codemirror/lint'
import { type Extension, StateEffect, StateField } from '@codemirror/state'
import { type EditorView } from '@codemirror/view'
import * as iter from 'enso-common/src/utilities/data/iter'
import { computed, shallowRef, watch } from 'vue'
import { type Diagnostic as LSDiagnostic } from 'ydoc-shared/languageServerTypes'

const executionContextDiagnostics = shallowRef<Diagnostic[]>([])

// Effect that can be applied to the document to invalidate the linter state.
const diagnosticsUpdated = StateEffect.define()
// State value that is perturbed by any `diagnosticsUpdated` effect.
const diagnosticsVersion = StateField.define({
  create: (_state) => 0,
  update: (value, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(diagnosticsUpdated)) value += 1
    }
    return value
  },
})

/** TODO: Add docs */
function lsDiagnosticsToCMDiagnostics(source: string, diagnostics: LSDiagnostic[]): Diagnostic[] {
  if (!diagnostics.length) return []
  const results: Diagnostic[] = []
  let pos = 0
  const lineStartIndices = []
  for (const line of source.split('\n')) {
    lineStartIndices.push(pos)
    pos += line.length + 1
  }
  for (const diagnostic of diagnostics) {
    if (!diagnostic.location) continue
    const from =
      (lineStartIndices[diagnostic.location.start.line] ?? 0) + diagnostic.location.start.character
    const to =
      (lineStartIndices[diagnostic.location.end.line] ?? 0) + diagnostic.location.end.character
    if (to > source.length || from > source.length) {
      // Suppress temporary errors if the source is not the version of the document the LS is reporting diagnostics for.
      continue
    }
    const severity =
      diagnostic.kind === 'Error' ? 'error'
      : diagnostic.kind === 'Warning' ? 'warning'
      : 'info'
    results.push({ from, to, message: diagnostic.message, severity })
  }
  return results
}

export function ensoDiagnostics(
  projectStore: Pick<ProjectStore, 'computedValueRegistry' | 'dataflowErrors' | 'diagnostics'>,
  graphStore: Pick<GraphStore, 'moduleSource' | 'db'>,
  editorView: EditorView,
): Extension {
  const expressionUpdatesDiagnostics = computed(() => {
    const updates = projectStore.computedValueRegistry.db
    const panics = updates.type.reverseLookup('Panic')
    const errors = updates.type.reverseLookup('DataflowError')
    const diagnostics: Diagnostic[] = []
    for (const externalId of iter.chain(panics, errors)) {
      const update = updates.get(externalId)
      if (!update) continue
      const astId = graphStore.db.idFromExternal(externalId)
      if (!astId) continue
      const span = graphStore.moduleSource.getSpan(astId)
      if (!span) continue
      const [from, to] = span
      switch (update.payload.type) {
        case 'Panic': {
          diagnostics.push({ from, to, message: update.payload.message, severity: 'error' })
          break
        }
        case 'DataflowError': {
          const error = projectStore.dataflowErrors.lookup(externalId)
          if (error?.value?.message) {
            diagnostics.push({ from, to, message: error.value.message, severity: 'error' })
          }
          break
        }
      }
    }
    return diagnostics
  })
  watch([executionContextDiagnostics, expressionUpdatesDiagnostics], () => {
    editorView.dispatch({ effects: diagnosticsUpdated.of(null) })
    forceLinting(editorView)
  })
  // The LS protocol doesn't identify what version of the file updates are in reference to. When diagnostics are received
  // from the LS, we map them to the text assuming that they are applicable to the current version of the module. This
  // will be correct if there is no one else editing, and we aren't editing faster than the LS can send updates. Typing
  // too quickly can result in incorrect ranges, but at idle it should correct itself when we receive new diagnostics.
  watch(
    () => projectStore.diagnostics,
    (diagnostics) => {
      const moduleSourceValue = graphStore.moduleSource.text
      executionContextDiagnostics.value =
        moduleSourceValue ? lsDiagnosticsToCMDiagnostics(moduleSourceValue, diagnostics) : []
    },
  )
  return [
    diagnosticsVersion,
    linter(() => [...executionContextDiagnostics.value, ...expressionUpdatesDiagnostics.value], {
      needsRefresh(update) {
        return (
          update.state.field(diagnosticsVersion) !== update.startState.field(diagnosticsVersion)
        )
      },
    }),
  ]
}
