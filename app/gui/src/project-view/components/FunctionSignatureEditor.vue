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
  <div ref="rootElement" class="FunctionSignatureEditor">
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
  padding: 20px;
  min-height: 100px;
}
</style>
