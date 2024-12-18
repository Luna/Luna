<script setup lang="ts">
import GraphEditor from '@/components/GraphEditor.vue'
import { provideBackend } from '@/providers/backend'
import { provideEventLogger } from '@/providers/eventLogging'
import { provideVisibility } from '@/providers/visibility'
import type { LsUrls } from '@/stores/project'
import { provideProjectStore } from '@/stores/project'
import { provideSettings } from '@/stores/settings'
import { Opt } from '@/util/data/opt'
import { useEventListener } from '@vueuse/core'
import type Backend from 'enso-common/src/services/Backend'
import { computed, markRaw, ref, toRaw, toRef, watch } from 'vue'

const props = defineProps<{
  projectId: string
  projectName: string
  projectDisplayedName: string
  projectNamespace?: string
  engine: LsUrls
  renameProject: (newName: string) => void
  hidden: boolean
  /** The current project's backend, which may be remote or local. */
  projectBackend?: Opt<Backend>
  /**
   * The remote backend.
   *
   * This is used regardless of whether the project is local for e.g. the cloud file browser.
   */
  remoteBackend?: Opt<Backend>
}>()

provideBackend({
  project: () => (props.projectBackend && markRaw(toRaw(props.projectBackend))) ?? null,
  remote: () => (props.remoteBackend && markRaw(toRaw(props.remoteBackend))) ?? null,
})

const logger = provideEventLogger(
  ref((message: string, projectId?: string | null, metadata?: object | null) => {
    void props.remoteBackend?.logEvent(message, projectId, metadata)
  }),
  toRef(props, 'projectId'),
)
watch(
  toRef(props, 'projectId'),
  (_id, _oldId, onCleanup) => {
    logger.send('ide_project_opened')
    onCleanup(() => logger.send('ide_project_closed'))
  },
  { immediate: true },
)

useEventListener(window, 'beforeunload', () => logger.send('ide_project_closed'))

provideProjectStore(props)
provideSettings()
provideVisibility(computed(() => !props.hidden))
</script>

<template>
  <div class="ProjectView">
    <GraphEditor />
  </div>
</template>

<style scoped>
.ProjectView {
  flex: 1;
  color: var(--color-text);
  font-family: var(--font-sans);
  font-weight: 500;
  font-size: 11.5px;
  line-height: 20px;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  pointer-events: all;
  cursor: default;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  position: absolute;
}

.endo-dashboard .GraphEditor {
  /* Compensate for top bar, render the app below it. */
  top: calc(var(--row-height) + 16px);
  flex: 1;
}

:deep(*),
:deep(*)::before,
:deep(*)::after {
  box-sizing: border-box;
  margin: 0;
}

:deep(.icon) {
  width: 16px;
  height: 16px;
}

/* Scrollbar style definitions for textual visualizations which need support for scrolling.
 *
 * The 11px width/height (depending on scrollbar orientation)
 * is set so that it resembles macOS default scrollbar.
 */

:deep(.scrollable) {
  scrollbar-color: rgba(190 190 190 / 50%) transparent;
  &::-webkit-scrollbar {
    -webkit-appearance: none;
  }
  &::-webkit-scrollbar-track {
    -webkit-box-shadow: none;
  }
  &::-webkit-scrollbar:vertical {
    width: 11px;
  }
  &::-webkit-scrollbar:horizontal {
    height: 11px;
  }
  &::-webkit-scrollbar-thumb {
    border-radius: 8px;
    border: 1px solid rgba(220, 220, 220, 0.5);
    background-color: rgba(190, 190, 190, 0.5);
  }
  &::-webkit-scrollbar-corner {
    background: rgba(0, 0, 0, 0);
  }
  &::-webkit-scrollbar-button {
    height: 8px;
    width: 8px;
  }
}

:deep(.draggable) {
  cursor: grab;
}

:deep(.clickable) {
  cursor: pointer;
}

:deep([data-use-vue-component-wrap]) {
  display: contents !important;
}
</style>
