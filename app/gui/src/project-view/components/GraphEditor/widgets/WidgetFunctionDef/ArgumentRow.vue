<script setup lang="ts">
import NodeWidget from '@/components/GraphEditor/NodeWidget.vue'
import SvgIcon from '@/components/SvgIcon.vue'
import { WidgetInput } from '@/providers/widgetRegistry'
import { computed } from 'vue'
import { ArgumentDefinition, ConcreteRefs } from 'ydoc-shared/ast'
import { andThen, isSome } from 'ydoc-shared/util/data/opt'

const { definition } = defineProps<{
  definition: ArgumentDefinition<ConcreteRefs>
}>()

const allWidgets = computed(() =>
  [
    andThen(definition.open?.node, WidgetInput.FromAst),
    andThen(definition.open2?.node, WidgetInput.FromAst),
    andThen(definition.suspension?.node, WidgetInput.FromAst),
    andThen(definition.pattern?.node, WidgetInput.FromAst),
    andThen(definition.type?.operator.node, WidgetInput.FromAst),
    andThen(definition.type?.type.node, WidgetInput.FromAst),
    andThen(definition.close2?.node, WidgetInput.FromAst),
    andThen(definition.defaultValue?.equals.node, WidgetInput.FromAst),
    andThen(definition.defaultValue?.expression.node, WidgetInput.FromAst),
    andThen(definition.close?.node, WidgetInput.FromAst),
  ].flatMap((v, key) => (isSome(v) ? ([[key, v]] as const) : [])),
)
</script>

<template>
  <div class="ArgumentRow widgetResetPadding">
    <SvgIcon name="sort" />
    <NodeWidget v-for="[key, widget] of allWidgets" :key="key" :input="widget" />
  </div>
</template>

<style scoped>
.ArgumentRow {
  display: flex;
  flex-direction: row;
  place-items: center;
  overflow-x: clip;

  .SvgIcon {
    color: color-mix(in srgb, currentColor, transparent 50%);
    margin-right: 4px;
  }
}
</style>
