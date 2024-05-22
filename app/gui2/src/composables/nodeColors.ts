import { useGraphStore, type NodeId } from '@/stores/graph'
import { type Group } from '@/stores/suggestionDatabase'
import { colorFromString } from '@/util/colors'
import { computed } from 'vue'

export function useNodeColors(getCssValue: (variable: string) => string) {
  const graphStore = useGraphStore()

  function getNodeColor(node: NodeId) {
    const color = graphStore.db.getNodeColorStyle(node)
    if (color.startsWith('var')) {
      // Some colors are defined in CSS variables, we need to get the actual color.
      const variableName = color.slice(4, -1)
      const value = getCssValue(variableName)
      if (value === '') return undefined
      return value
    } else {
      return color
    }
  }

  function getNodeColors(filter?: (node: NodeId) => boolean) {
    return computed(() => {
      const colors = new Set<string>()
      for (const node of graphStore.db.nodeIds()) {
        if (filter?.(node) !== false) {
          const color = getNodeColor(node)
          if (color) colors.add(color)
        }
      }
      return colors
    })
  }

  return { getNodeColor, getNodeColors }
}

export function computeNodeColor(
  getGroup: () => Group | undefined,
  getTypeName: () => string | undefined,
) {
  const group = getGroup()
  if (group) return groupColorStyle(group)
  const typeName = getTypeName()
  if (typeName) return colorFromString(typeName)
  return 'var(--node-color-no-type)'
}

export function groupColorVar(group: Group | undefined): string {
  const name = group ? `${group.project}-${group.name}`.replace(/[^\w]/g, '-') : 'fallback'
  return `--group-color-${name}`
}

export function groupColorStyle(group: Group | undefined): string {
  return `var(${groupColorVar(group)})`
}
