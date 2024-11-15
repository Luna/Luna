<script setup lang="ts">
import { defineWidget, Score, WidgetInput, widgetProps } from '@/providers/widgetRegistry'
import { getDocsIcon } from '@/stores/suggestionDatabase/documentation'
import { Ast } from '@/util/ast'
import { computed } from 'vue'
import NodeWidget from '../NodeWidget.vue'
import { FunctionName } from './WidgetFunctionName.vue'
import { DisplayIcon } from './WidgetIcon.vue'

const props = defineProps(widgetProps(widgetDefinition))

const funcIcon = computed(() => {
  return getDocsIcon(props.input.value.documentationText()) ?? 'enso_logo'
})

const funcNameInput = computed(() => {
  const nameAst = props.input.value.name
  return {
    ...WidgetInput.FromAst(nameAst),
    [DisplayIcon]: {
      icon: funcIcon.value,
      allowChoice: true,
      showContents: true,
    },
    [FunctionName]: {
      editableName: nameAst.externalId,
    },
  } satisfies WidgetInput
})

const definitions = computed(() => {
  return props.input.value.argumentDefinitions.map((def, i) => {
    return {
      id: i,
      open: def.open ? WidgetInput.FromAst(def.open.node) : null,
      open2: def.open2 ? WidgetInput.FromAst(def.open2.node) : null,
      suspension: def.suspension ? WidgetInput.FromAst(def.suspension.node) : null,
      pattern: def.pattern ? WidgetInput.FromAst(def.pattern.node) : null,
      operator: def.type ? WidgetInput.FromAst(def.type.operator.node) : null,
      type: def.type ? WidgetInput.FromAst(def.type.type.node) : null,
      close2: def.close2 ? WidgetInput.FromAst(def.close2.node) : null,
      equals: def.defaultValue ? WidgetInput.FromAst(def.defaultValue.equals.node) : null,
      default: def.defaultValue ? WidgetInput.FromAst(def.defaultValue.expression.node) : null,
      close: def.close ? WidgetInput.FromAst(def.close.node) : null,
    }
  })
})
</script>

<template>
  <div class="WidgetFunctionDef">
    <NodeWidget :input="funcNameInput" />
    <div v-for="definition in definitions" :key="definition.id" class="Argument widgetResetPadding">
      <NodeWidget v-if="definition.open" :input="definition.open" />
      <NodeWidget v-if="definition.open2" :input="definition.open2" />
      <NodeWidget v-if="definition.suspension" :input="definition.suspension" />
      <NodeWidget v-if="definition.pattern" :input="definition.pattern" />
      <NodeWidget v-if="definition.operator" :input="definition.operator" />
      <NodeWidget v-if="definition.type" :input="definition.type" />
      <NodeWidget v-if="definition.close2" :input="definition.close2" />
      <NodeWidget v-if="definition.equals" :input="definition.equals" />
      <NodeWidget v-if="definition.default" :input="definition.default" />
      <NodeWidget v-if="definition.close" :input="definition.close" />
    </div>
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
  flex-direction: row;
  align-items: center;
}

.Argument {
  display: flex;
  flex-direction: row;
  place-items: center;
  overflow-x: clip;

  &:before {
    content: '';
    display: block;
    align-self: stretch;
    margin-top: -4px;
    margin-bottom: -4px;
    margin-right: var(--widget-token-pad-unit);
    border-left: 1px solid rgb(0 0 0 / calc(0.12 * var(--size-transition-progress, 1)));
  }
}
</style>
