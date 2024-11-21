<script setup lang="ts">
import GraphEdge from '@/components/GraphEditor/GraphEdge.vue'
import type { GraphNavigator } from '@/providers/graphNavigator'
import { injectGraphSelection } from '@/providers/graphSelection'
import { injectInteractionHandler, type Interaction } from '@/providers/interactionHandler'
import type { PortId } from '@/providers/portInfo'
import { useGraphStore, type NodeId } from '@/stores/graph'
import { Ast } from '@/util/ast'
import { isAstId, type AstId } from '@/util/ast/abstract'
import { Vec2 } from '@/util/data/vec2'
import { toast } from 'react-toastify'
import { computed } from 'vue'

const graph = useGraphStore()
const selection = injectGraphSelection(true)
const interaction = injectInteractionHandler()

const props = defineProps<{
  navigator: GraphNavigator
}>()

const emits = defineEmits<{
  createNodeFromEdge: [source: AstId, position: Vec2]
}>()

const MIN_DRAG_MOVE = 10

const editingEdge: Interaction = {
  cancel: () => (graph.mouseEditedEdge = undefined),
  end: () => (graph.mouseEditedEdge = undefined),
  pointerdown: edgeInteractionClick,
  pointerup: (e: PointerEvent) => {
    const originEvent = graph.mouseEditedEdge?.event
    if (originEvent?.type === 'pointerdown') {
      const delta = new Vec2(e.screenX, e.screenY).sub(
        new Vec2(originEvent.screenX, originEvent.screenY),
      )
      if (delta.lengthSquared() >= MIN_DRAG_MOVE ** 2) return edgeInteractionClick()
    }
    return false
  },
}

function edgeInteractionClick() {
  if (graph.mouseEditedEdge == null) return false
  let source: AstId | undefined
  let sourceNode: NodeId | undefined
  if (graph.mouseEditedEdge.source) {
    source = graph.mouseEditedEdge.source
    sourceNode = graph.db.getPatternExpressionNodeId(source)
  } else if (selection?.hoveredNode) {
    sourceNode = selection.hoveredNode
    source = graph.db.getNodeFirstOutputPort(sourceNode)
  }
  const target = graph.mouseEditedEdge.target ?? selection?.hoveredPort
  const targetNode = target && graph.getPortNodeId(target)
  graph.batchEdits(() => {
    if (source != null && sourceNode != targetNode) {
      if (target == null) {
        if (graph.mouseEditedEdge?.disconnectedEdgeTarget != null)
          disconnectEdge(graph.mouseEditedEdge.disconnectedEdgeTarget)
        emits('createNodeFromEdge', source, props.navigator.sceneMousePos ?? Vec2.Zero)
      } else {
        createEdge(source, target)
      }
    } else if (source == null && target != null) {
      disconnectEdge(target)
    }
    graph.mouseEditedEdge = undefined
  })
  return true
}

interaction.setWhen(() => graph.mouseEditedEdge != null, editingEdge)

function disconnectEdge(target: PortId) {
  graph.edit((edit) => {
    if (!graph.updatePortValue(edit, target, undefined)) {
      if (isAstId(target)) {
        console.warn(`Failed to disconnect edge from port ${target}, falling back to direct edit.`)
        edit.replaceValue(target, Ast.Wildcard.new(edit))
      } else {
        console.error(`Failed to disconnect edge from port ${target}, no fallback possible.`)
      }
    }
  })
}

function createEdge(source: AstId, target: PortId) {
  const ident = graph.db.getOutputPortIdentifier(source)
  if (ident == null) return

  const sourceNode = graph.getSourceNodeId(source)
  const targetNode = graph.getPortNodeId(target)
  if (sourceNode == null || targetNode == null) {
    return console.error(`Failed to connect edge, source or target node not found.`)
  }

  const edit = graph.startEdit()
  const reorderResult = graph.ensureCorrectNodeOrder(edit, sourceNode, targetNode)
  if (reorderResult === 'circular') {
    // Creating this edge would create a circular dependency. Prevent that and display error.
    toast.error('Could not connect due to circular dependency.')
  } else {
    const identAst = Ast.parseExpression(ident, edit)!
    if (!graph.updatePortValue(edit, target, identAst)) {
      if (isAstId(target)) {
        console.warn(`Failed to connect edge to port ${target}, falling back to direct edit.`)
        edit.replaceValue(target, identAst)
        graph.commitEdit(edit)
      } else {
        console.error(`Failed to connect edge to port ${target}, no fallback possible.`)
      }
    }
  }
}

const VISIBLE_PORT_MASK_PADDING = 6
const masks = computed(() => {
  const nodes = graph.nodeRects.entries()
  return Array.from(nodes, ([nodeId, nodeRect]) => {
    const animProgress = graph.nodeHoverAnimations.get(nodeId) ?? 0
    const padding = animProgress * VISIBLE_PORT_MASK_PADDING
    const rect = nodeRect.expand(padding)
    const radius = 16 + padding
    const id = `mask_for_edge_from-${nodeId}`
    const viewport = props.navigator.viewport
    const outerPath = `M ${viewport.left},${viewport.top} L ${viewport.right},${viewport.top} L ${viewport.right},${viewport.bottom} L ${viewport.left},${viewport.bottom} z`
    const innerPath = `M ${rect.left},${rect.top} L ${rect.left},${rect.bottom} L ${rect.right},${rect.bottom} L ${rect.right},${rect.top} z`
    // d="M 30,30 L 30,90 L90,90 L90,30 z M0,0 L124,0 L124,124 L0,124 z"
    const path = `${innerPath} ${outerPath}`
    return { id, rect, radius, path }
  })
})
</script>

<template>
  <div>
    <svg :viewBox="props.navigator.viewBox" class="overlay behindNodes">
      <template v-for="mask in masks" :key="mask.id">
        <clipPath v-if="mask && navigator" :id="mask.id" clipPathUnits="userSpaceOnUse">
          <path :d="mask.path" />
        </clipPath>
      </template>
      <GraphEdge v-for="edge in graph.connectedEdges" :key="edge.target" :edge="edge" />
      <GraphEdge v-if="graph.cbEditedEdge" :edge="graph.cbEditedEdge" />
      <GraphEdge
        v-if="graph.outputSuggestedEdge"
        :edge="graph.outputSuggestedEdge"
        animateFromSourceHover
      />
    </svg>
    <svg v-if="graph.mouseEditedEdge" :viewBox="props.navigator.viewBox" class="overlay aboveNodes">
      <GraphEdge :edge="graph.mouseEditedEdge" maskSource />
    </svg>
  </div>
</template>

<style scoped>
.overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.overlay.behindNodes {
  z-index: -1;
}

.overlay.aboveNodes {
  z-index: 20;
}
</style>
