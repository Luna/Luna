<script setup lang="ts">
import MenuButton from '@/components/MenuButton.vue'
import SvgIcon from '@/components/SvgIcon.vue'
import { type ComponentAction } from '@/util/componentActions'

const { action } = defineProps<{ action: ComponentAction }>()
</script>

<template>
  <!-- eslint-disable vue/no-mutating-props -- `ComponentAction` is an internally-reactive object. -->
  <MenuButton
    :data-testid="action.testid"
    :disabled="action.disabled"
    class="ComponentActionButton"
    v-bind="action.state != null ? { modelValue: action.state } : {}"
    @update:modelValue="action.state != null && (action.state = $event)"
    @click="action.action"
  >
    <!-- eslint-enable vue/no-mutating-props -->
    <SvgIcon :name="action.icon" class="rowIcon" />
    <span v-text="action.description" />
    <span v-if="action.shortcut" class="shortcutHint" v-text="action.shortcut" />
  </MenuButton>
</template>

<style scoped>
.ComponentActionButton {
  display: flex;
  align-items: center;
  justify-content: left;
  padding-left: 8px;
  padding-right: 8px;
}

.rowIcon {
  display: inline-block;
  margin-right: 8px;
}

.shortcutHint {
  margin-left: auto;
  padding-left: 2em;
  opacity: 0.8;
}
</style>
