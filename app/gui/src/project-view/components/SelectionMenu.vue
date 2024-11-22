<script setup lang="ts">
import ColorPickerMenu from '@/components/ColorPickerMenu.vue'
import SelectionActionButton from '@/components/SelectionActionButton.vue'
import { injectSelectionActions } from '@/providers/selectionActions'

const { selectedNodeCount, actions } = injectSelectionActions()
const { collapse, copy, deleteSelected, pickColorMulti } = actions
</script>

<template>
  <Transition>
    <div v-if="selectedNodeCount > 1" class="SelectionMenu">
      <span v-text="`${selectedNodeCount} components selected`" />
      <SelectionActionButton :action="collapse" />
      <SelectionActionButton
        :action="pickColorMulti"
        :class="{
          // Any `pointerdown` event outside the color picker will close it. Ignore clicks that occur while the color
          // picker is open, so that it isn't toggled back open.
          disableInput: pickColorMulti.state,
        }"
      />
      <SelectionActionButton :action="copy" />
      <SelectionActionButton :action="deleteSelected" />
      <ColorPickerMenu
        v-if="pickColorMulti.state"
        class="submenu"
        @close="pickColorMulti.state = false"
      />
    </div>
  </Transition>
</template>

<style scoped>
.SelectionMenu {
  user-select: none;
  display: flex;
  border-radius: var(--radius-full);
  background: var(--color-frame-bg);
  backdrop-filter: var(--blur-app-bg);
  place-items: center;
  gap: 12px;
  padding-left: 10px;
  padding-right: 10px;
  padding-top: 4px;
  padding-bottom: 4px;
}

.submenu {
  position: absolute;
  top: 36px;
  left: 0;
  border-radius: var(--radius-default);
  background: var(--color-frame-bg);
  backdrop-filter: var(--blur-app-bg);
}

.toggledOff svg {
  opacity: 0.6;
}

.disableInput {
  pointer-events: none;
}

.v-enter-active,
.v-leave-active {
  transition: opacity 0.25s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
