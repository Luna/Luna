<script setup lang="ts">
import { WidgetInput } from '@/providers/widgetRegistry'
import { computed, ref } from 'vue'
import { FunctionDef } from 'ydoc-shared/ast'
import WidgetTreeRoot from './GraphEditor/WidgetTreeRoot.vue'

const { functionAst } = defineProps<{
  functionAst: FunctionDef
}>()

const treeRootInput = computed(() => {
  return WidgetInput.FromAst(functionAst)
})

const rootElement = ref<HTMLElement>()

function handleWidgetUpdates() {
  return true
}
</script>

<template>
  <div ref="rootElement" class="FunctionSignatureEditor define-node-colors">
    <WidgetTreeRoot
      :externalId="functionAst.externalId"
      :input="treeRootInput"
      :rootElement="rootElement"
      :extended="true"
      :onUpdate="handleWidgetUpdates"
    />
  </div>
</template>

<style scoped>
.FunctionSignatureEditor {
  margin: 4px 8px;
  padding: 4px;

  /* TODO */
  --node-group-color: var(--group-color-fallback);

  border-radius: var(--node-border-radius);
  transition: background-color 0.2s ease;
  background-color: var(--node-color-primary);
  box-sizing: border-box;
}
</style>
