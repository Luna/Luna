<script lang="ts" setup>
import { Vec2 } from '@/util/data/vec2'
import { computed, ref, watchEffect } from 'vue'

const props = defineProps<{
  nodePosition: Vec2
  nodeSize: Vec2
  selected: boolean
  externalHovered: boolean
  color: string
}>()

const emit = defineEmits<{
  visible: [boolean]
}>()

const hovered = ref(false)
const visible = computed(() => props.selected || props.externalHovered || hovered.value)

watchEffect(() => emit('visible', visible.value))

const rootStyle = computed(() => {
  const { x, y } = props.nodePosition
  return {
    transform: `translate(${x}px, ${y}px)`,
    '--node-size-x': `${props.nodeSize.x}px`,
    '--node-size-y': `${props.nodeSize.y}px`,
    '--selection-color': props.color,
  }
})
</script>

<template>
  <div
    class="GraphNodeSelection"
    :class="{ visible, selected: props.selected }"
    :style="rootStyle"
    @pointerenter="hovered = true"
    @pointerleave="hovered = false"
  />
</template>

<style scoped>
.GraphNodeSelection {
  position: absolute;
  contain: strict;
  inset: calc(0px - var(--selected-node-border-width));
  width: calc(var(--selected-node-border-width) * 2 + var(--node-size-x));
  height: calc(var(--selected-node-border-width) + var(--node-base-height) / 2);
  border-radius: 0;
  border-top-left-radius: calc(var(--node-border-radius) * 2 + var(--selected-node-border-width));
  border-top-right-radius: calc(var(--node-border-radius) * 2 + var(--selected-node-border-width));
  border-bottom-left-radius: calc(var(--node-border-radius));
  border-bottom-right-radius: calc(var(--node-border-radius));

  &:before {
    position: absolute;
    content: '';
    opacity: 0;
    display: block;
    inset: var(--selected-node-border-width);

    transition:
      box-shadow 0.2s ease-in-out;
  }
}

.GraphNodeSelection.visible::before {
  box-shadow: 0 0 0 var(--selected-node-border-width) var(--selection-color);
}

.GraphNodeSelection:hover::before {
  opacity: 0.3;
}
</style>
