import { graphBindings } from '@/bindings'
import { createContextStore } from '@/providers'
import {
  injectSingleComponentActions,
  type SingleComponentActions,
} from '@/providers/singleComponentActions'
import { type Node } from '@/stores/graph'
import { type ComponentAction, componentAction } from '@/util/componentActions'
import { type ToValue } from '@/util/reactivity'
import * as iter from 'enso-common/src/utilities/data/iter'
import { type DisjointKeysUnion } from 'enso-common/src/utilities/data/object'
import { computed, type ComputedRef, type Ref, ref, toValue } from 'vue'

export type SelectionActions = Record<
  'collapse' | 'copy' | 'deleteSelected' | 'pickColorMulti',
  ComponentAction<void>
>

function useSelectionActions(
  selectedNodes: ToValue<Iterable<Node>>,
  actions: {
    collapseNodes: (nodes: Node[]) => void
    copyNodesToClipboard: (nodes: Node[]) => void
    deleteNodes: (nodes: Node[]) => void
  },
): { selectedNodeCount: Readonly<Ref<number>>; actions: SelectionActions } {
  function everyNode(predicate: (node: Node) => boolean): ComputedRef<boolean> {
    return computed(() => iter.every(toValue(selectedNodes), predicate))
  }
  const selectedNodesArray = computed(() => [...toValue(selectedNodes)])
  const selectedNodeCount = computed<number>(() => toValue(selectedNodesArray).length)
  const singleNodeSelected = computed<boolean>(() => selectedNodeCount.value === 1)
  const noNormalNodes = everyNode((node) => node.type !== 'component')
  function action(action: keyof typeof actions): () => void {
    return () => actions[action](toValue(selectedNodesArray))
  }
  return {
    selectedNodeCount,
    actions: {
      collapse: componentAction({
        disabled: computed(() => singleNodeSelected.value || noNormalNodes.value),
        icon: 'group',
        description: 'Group Selected Components',
        shortcut: graphBindings.bindings.collapse,
        action: action('collapseNodes'),
      }),
      copy: componentAction({
        disabled: noNormalNodes,
        icon: 'copy2',
        description: computed(() =>
          singleNodeSelected.value ? 'Copy Component' : 'Copy Selected Components',
        ),
        shortcut: graphBindings.bindings.copyNode,
        action: action('copyNodesToClipboard'),
      }),
      deleteSelected: componentAction({
        disabled: noNormalNodes,
        icon: 'trash2',
        description: computed(() =>
          singleNodeSelected.value ? 'Delete Component' : 'Delete Selected Components',
        ),
        shortcut: graphBindings.bindings.deleteSelected,
        action: action('deleteNodes'),
        testid: 'removeNode',
      }),
      pickColorMulti: componentAction({
        state: ref(false),
        disabled: computed(() => singleNodeSelected.value || noNormalNodes.value),
        icon: 'paint_palette',
        description: 'Color Selected Components',
      }),
    },
  }
}

export { injectFn as injectSelectionActions, provideFn as provideSelectionActions }
const { provideFn, injectFn } = createContextStore('Selection actions', useSelectionActions)

export type ComponentAndSelectionActions = DisjointKeysUnion<
  SingleComponentActions,
  SelectionActions
>

/** Returns all {@link ComponentAction}s, including the single-component actions and the selected-components actions. */
export function injectComponentAndSelectionActions(): {
  selectedNodeCount: Readonly<Ref<number>>
  actions: ComponentAndSelectionActions
} {
  const selectionActions = injectFn()
  const componentActions = injectSingleComponentActions()
  return {
    ...selectionActions,
    actions: { ...selectionActions.actions, ...componentActions },
  }
}
