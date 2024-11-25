<script setup lang="ts">
import NodeWidget from '@/components/GraphEditor/NodeWidget.vue'
import { FunctionName } from '@/components/GraphEditor/widgets/WidgetFunctionName.vue'
import { DisplayIcon } from '@/components/GraphEditor/widgets/WidgetIcon.vue'
import { defineWidget, Score, WidgetInput, widgetProps } from '@/providers/widgetRegistry'
import { getDocsIcon } from '@/stores/suggestionDatabase/documentation'
import { Ast } from '@/util/ast'
import { computed } from 'vue'
import ArgumentRow from './WidgetFunctionDef/ArgumentRow.vue'

const props = defineProps(widgetProps(widgetDefinition))

const funcIcon = computed(() => {
  return getDocsIcon(props.input.value.mutableDocumentationMarkdown().toJSON()) ?? 'enso_logo'
})

const funcNameInput = computed(() => {
  const displayIcon = {
    [DisplayIcon]: {
      icon: funcIcon.value,
      allowChoice: true,
      showContents: true,
    },
  }

  const nameAst = props.input.value.name
  const canEditName = nameAst.code() !== 'main'
  const editableName =
    canEditName ?
      {
        [FunctionName]: {
          editableName: nameAst.externalId,
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
      v-for="(definition, i) in props.input.value.argumentDefinitions"
      :key="i"
      :definition="definition"
    />
  </div>
</template>

<script lang="ts">
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
  align-items: center;
}
</style>
