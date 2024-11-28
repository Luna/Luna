<script setup lang="ts">
import SvgButton from '@/components/SvgButton.vue'
import ToggleIcon from '@/components/ToggleIcon.vue'
import { injectSelectionActions, type SelectionActions } from '@/providers/selectionActions'

const { action: actionName } = defineProps<{ action: keyof SelectionActions }>()

const { actions } = injectSelectionActions()
const action = actions[actionName]
</script>

<template>
  <ToggleIcon
    v-if="action.state != null"
    v-model="action.state"
    :icon="action.icon"
    :disabled="action.disabled"
    :title="action.descriptionWithShortcut"
    @click.stop="action.action ?? ''"
  />
  <SvgButton
    v-else
    :name="action.icon"
    :disabled="action.disabled"
    :title="action.descriptionWithShortcut"
    @click.stop="action.action"
  />
</template>
