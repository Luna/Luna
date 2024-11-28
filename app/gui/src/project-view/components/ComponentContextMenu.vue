<script setup lang="ts">
import ComponentActionButton from '@/components/ComponentActionButton.vue'
import MenuPanel from '@/components/MenuPanel.vue'
import { type SelectionActions } from '@/providers/selectionActions'
import { type SingleComponentActions } from '@/providers/singleComponentActions'

const emit = defineEmits<{ close: [] }>()

const componentActions: (keyof SingleComponentActions)[] = [
  'toggleDocPanel',
  'toggleVisualization',
  'createNewNode',
  'editingComment',
  'recompute',
  'pickColor',
  'enterNode',
  'startEditing',
]
const selectionActions: (keyof SelectionActions)[] = ['copy', 'deleteSelected']
const actions = [...componentActions, ...selectionActions]
</script>

<template>
  <MenuPanel class="ComponentContextMenu" @contextmenu.stop.prevent="emit('close')">
    <ComponentActionButton
      v-for="action in actions"
      :key="action"
      :action="action"
      @click.stop="emit('close')"
    />
  </MenuPanel>
</template>

<style scoped>
.MenuPanel {
  margin-top: 2px;
  padding: 4px;
  background: var(--dropdown-opened-background, var(--color-app-bg));
  backdrop-filter: var(--dropdown-opened-backdrop-filter, var(--blur-app-bg));
}
</style>
