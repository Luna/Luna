<script setup lang="ts">
import ComponentActionButton from '@/components/ComponentActionButton.vue'
import MenuPanel from '@/components/MenuPanel.vue'
import { injectSelectionActions } from '@/providers/selectionActions'
import { injectComponentActions } from '@/util/componentActions'

const emit = defineEmits<{ close: [] }>()

const componentActions = injectComponentActions()
const { actions: selectionActions } = injectSelectionActions()

const componentActionButtons: (keyof typeof componentActions)[] = [
  'toggleDocPanel',
  'toggleVisualization',
  'createNewNode',
  'editingComment',
  'recompute',
  'pickColor',
  'enterNode',
  'startEditing',
]
const selectionActionButtons: (keyof typeof selectionActions)[] = ['copy', 'deleteSelected']
</script>

<template>
  <MenuPanel class="ComponentContextMenu" @contextmenu.stop.prevent="emit('close')">
    <ComponentActionButton
      v-for="action in componentActionButtons"
      :key="`component:${action}`"
      :action="componentActions[action]"
      @click.stop="emit('close')"
    />
    <ComponentActionButton
      v-for="action in selectionActionButtons"
      :key="`selection:${action}`"
      :action="selectionActions[action]"
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
