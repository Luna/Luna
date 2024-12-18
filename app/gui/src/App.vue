<script setup lang="ts">
import '@/assets/base.css'
import TooltipDisplayer from '@/components/TooltipDisplayer.vue'
import { provideAppClassSet } from '@/providers/appClass'
import { provideGuiConfig } from '@/providers/guiConfig'
import { provideTooltipRegistry } from '@/providers/tooltipRegistry'
import { registerAutoBlurHandler } from '@/util/autoBlur'
import { baseConfig, configValue, mergeConfig, type ApplicationConfigValue } from '@/util/config'
import { urlParams } from '@/util/urlParams'
import { useQueryClient } from '@tanstack/vue-query'
import { MotionGlobalConfig } from 'framer-motion'
import { applyPureReactInVue } from 'veaury'
import { computed, onMounted } from 'vue'
import ReactRoot from './ReactRoot'

const classSet = provideAppClassSet()
const appTooltips = provideTooltipRegistry()

const appConfig = computed(() => {
  const config = mergeConfig(baseConfig, urlParams(), {
    onUnrecognizedOption: (p) => console.warn('Unrecognized option:', p),
  })
  return config
})
const appConfigValue = computed((): ApplicationConfigValue => configValue(appConfig.value))

const ReactRootWrapper = applyPureReactInVue(ReactRoot)
const queryClient = useQueryClient()

provideGuiConfig(appConfigValue)

registerAutoBlurHandler()

onMounted(() => {
  if (appConfigValue.value.window.vibrancy) {
    document.body.classList.add('vibrancy')
  }
})
</script>

<template>
  <Teleport to="body">
    <TooltipDisplayer :registry="appTooltips" />
  </Teleport>
  <ReactRootWrapper :config="appConfigValue" :queryClient="queryClient" :classSet="classSet" />
</template>

<style></style>
