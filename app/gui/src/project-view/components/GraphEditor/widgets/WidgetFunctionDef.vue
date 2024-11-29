<script setup lang="ts">
import NodeWidget from '@/components/GraphEditor/NodeWidget.vue'
import { FunctionName } from '@/components/GraphEditor/widgets/WidgetFunctionName.vue'
import { DisplayIcon } from '@/components/GraphEditor/widgets/WidgetIcon.vue'
import { defineWidget, Score, WidgetInput, widgetProps } from '@/providers/widgetRegistry'
import { getDocsIcon } from '@/stores/suggestionDatabase/documentation'
import { Ast } from '@/util/ast'
import { computed } from 'vue'
import { MethodPointer } from 'ydoc-shared/languageServerTypes'
import ArgumentRow from './WidgetFunctionDef/ArgumentRow.vue'

const { input } = defineProps(widgetProps(widgetDefinition))

const funcIcon = computed(() => {
  return getDocsIcon(input.value.mutableDocumentationMarkdown().toJSON()) ?? 'enso_logo'
})

const funcNameInput = computed(() => {
  const displayIcon = {
    [DisplayIcon]: {
      icon: funcIcon.value,
      allowChoice: true,
      showContents: true,
    },
  }

  const nameAst = input.value.name
  const methodPointer = input[FunctionInfoKey]?.methodPointer
  console.log('methodPointer', methodPointer)
  const editableName =
    nameAst.code() !== 'main' && methodPointer != null ?
      {
        [FunctionName]: {
          editableNameExpression: nameAst.externalId,
          methodPointer,
        },
      }
    : {}

  return {
    ...WidgetInput.FromAst(nameAst),
    ...displayIcon,
    ...editableName,
  } satisfies WidgetInput
})
</script>

<template>
  <div class="WidgetFunctionDef">
    <NodeWidget :input="funcNameInput" />
    <ArgumentRow
      v-for="(definition, i) in input.value.argumentDefinitions"
      :key="i"
      :definition="definition"
    />
  </div>
</template>

<script lang="ts">
export const FunctionInfoKey: unique symbol = Symbol.for('WidgetInput:FunctionInfoKey')
declare module '@/providers/widgetRegistry' {
  export interface WidgetInput {
    [FunctionInfoKey]?: {
      methodPointer: MethodPointer
    }
  }
}
export const widgetDefinition = defineWidget(
  WidgetInput.astMatcher(Ast.FunctionDef),
  {
    priority: 999,
    score: Score.Perfect,
  },
  import.meta.hot,
)
</script>

<style scoped>
.WidgetFunctionDef {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
</style>
