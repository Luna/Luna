<script setup lang="ts">
import SvgButton from '@/components/SvgButton.vue'
import { useNodeExecution } from '@/composables/nodeExecution'
import { useProjectStore } from '@/stores/project'
import ControlButtons from './ControlButtons.vue'

const nodeExecution = useNodeExecution(useProjectStore())
</script>

<template>
  <ControlButtons class="RecordControl">
    <template #left>
      <SvgButton
        title="Refresh"
        class="iconButton"
        name="refresh"
        draggable="false"
        @click.stop="nodeExecution.recomputeAll()"
      />
    </template>
    <template #right>
      <SvgButton
        title="Write All"
        class="iconButton"
        name="workflow_play"
        draggable="false"
        @click.stop="nodeExecution.recomputeAll('Live')"
      />
    </template>
  </ControlButtons>
</template>

<style scoped>
.iconButton:active {
  color: #ba4c40;
}
</style>
