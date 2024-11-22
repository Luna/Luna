import { graphBindings } from '@/bindings'
import { createContextStore } from '@/providers'
import { type Node, type NodeId } from '@/stores/graph'
import { isInputNode } from '@/stores/graph/graphDatabase'
import { componentAction } from '@/util/componentActions'
import { type ToValue } from '@/util/reactivity'
import * as iter from 'enso-common/src/utilities/data/iter'
import { computed, type ComputedRef, ref, toValue } from 'vue'

/** Returns a reactive value containing the currently-selected nodes, in order.  */
export function useSelectedNodes(
  selectedNodeIds: ToValue<Set<NodeId>>,
  nodeIdToNode: (nodeId: NodeId) => Node | undefined,
  pickInCodeOrder: (nodeIds: Set<NodeId>) => Iterable<NodeId>,
) {
  const selectedInputNodes = computed(() => {
    const inputNodes = [
      ...iter.filter(
        iter.filterDefined(iter.map(toValue(selectedNodeIds), nodeIdToNode)),
        isInputNode,
      ),
    ]
    inputNodes.sort((a, b) => a.argIndex - b.argIndex)
    return inputNodes
  })

  const selectedNonInputNodes = computed(() => [
    ...iter.filterDefined(iter.map(pickInCodeOrder(toValue(selectedNodeIds)), nodeIdToNode)),
  ])

  return {
    /** The currently-selected nodes, in order. */
    selectedNodes: computed(() => [...selectedInputNodes.value, ...selectedNonInputNodes.value]),
  }
}

function useSelectionActions(
  selectedNodes: ToValue<Node[]>,
  actions: {
    collapseNodes: (nodes: Node[]) => void
    copyNodesToClipboard: (nodes: Node[]) => void
    deleteNodes: (nodes: Node[]) => void
  },
) {
  function everyNode(predicate: (node: Node) => boolean): ComputedRef<boolean> {
    return computed(() => iter.every(toValue(selectedNodes), predicate))
  }
  const selectedNodeCount = computed<number>(() => toValue(selectedNodes).length)
  const singleNodeSelected = computed<boolean>(() => selectedNodeCount.value === 1)
  const noNormalNodes = everyNode((node) => node.type !== 'component')
  function action(action: keyof typeof actions): () => void {
    return () => actions[action](toValue(selectedNodes))
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
