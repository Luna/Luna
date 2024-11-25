<script setup lang="ts">
/**
 * @file This component is equivalent to `Teleport` (with `defer` enabled) except when `disabled` is `true`, if `to`
 * doesn't specify a valid teleportation target, Vue won't crash.
 */
import { type RendererElement } from 'vue'

const { disabled } = defineProps<{
  disabled: boolean
  to: string | RendererElement | null | undefined
}>()
</script>

<template>
  <Teleport v-if="!disabled" defer :to="to">
    <slot />
  </Teleport>
  <slot v-else />
</template>
