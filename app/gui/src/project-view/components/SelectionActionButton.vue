<script setup lang="ts">
import SvgButton from '@/components/SvgButton.vue'
import ToggleIcon from '@/components/ToggleIcon.vue'
import { ComponentAction } from '@/util/componentActions'

const { action } = defineProps<{ action: ComponentAction }>()
</script>

<template>
  <!-- eslint-disable vue/no-mutating-props -- `ComponentAction` is an internally-reactive object. -->
  <ToggleIcon
    v-if="action.state != null"
    v-model="action.state"
    :icon="action.icon"
    :disabled="action.disabled"
    :title="action.descriptionWithShortcut"
    @click.stop="action.action ?? ''"
  />
  <!-- eslint-enable vue/no-mutating-props -->
  <SvgButton
    v-else
    :name="action.icon"
    :disabled="action.disabled"
    :title="action.descriptionWithShortcut"
    @click.stop="action.action"
  />
</template>
