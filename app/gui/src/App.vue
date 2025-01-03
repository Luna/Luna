<script setup lang="ts">
import { ProjectViewProps } from '#/layouts/Editor'
import '@/assets/base.css'
import TooltipDisplayer from '@/components/TooltipDisplayer.vue'
import { provideAppClassSet } from '@/providers/appClass'
import { provideGuiConfig } from '@/providers/guiConfig'
import { provideTooltipRegistry } from '@/providers/tooltipRegistry'
import { registerAutoBlurHandler } from '@/util/autoBlur'
import { baseConfig, configValue, mergeConfig, type ApplicationConfigValue } from '@/util/config'
import { urlParams } from '@/util/urlParams'
import ProjectView from '@/views/ProjectView.vue'
import { useQueryClient } from '@tanstack/vue-query'
import { applyPureReactInVue } from 'veaury'
import { computed, onMounted } from 'vue'
import ReactRoot from './ReactRoot'

const _props = defineProps<{
  // Used in Project View integration tests. Once both test projects will be merged, this should be
  // removed
  projectViewOnly?: { options: ProjectViewProps } | null
  onAuthenticated?: (accessToken: string | null) => void
}>()

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
  <ProjectView
    v-if="projectViewOnly"
    v-bind="projectViewOnly.options"
    :class="['App', ...classSet.keys()]"
  />
  <ReactRootWrapper
    v-else
    :config="appConfigValue"
    :queryClient="queryClient"
    :classSet="classSet"
    @authenticated="onAuthenticated ?? (() => {})"
  />
</template>
