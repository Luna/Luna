<script setup lang="ts">
import ComponentDocumentation from '@/components/ComponentDocumentation.vue'
import DockPanel, { type TabButton } from '@/components/DockPanel.vue'
import DocumentationEditor from '@/components/DocumentationEditor.vue'
import FunctionSignatureEditor from '@/components/FunctionSignatureEditor.vue'
import { useRightDock } from '@/stores/rightDock'
import { ref } from 'vue'
import { SuggestionId } from 'ydoc-shared/languageServerTypes/suggestions'
import * as Y from 'yjs'

const dockStore = useRightDock()

const displayedDocsSuggestion = defineModel<SuggestionId | undefined>('displayedDocs')

const props = defineProps<{ aiMode: boolean }>()

// type Tabs = (typeof tabButtons)[number]['tab']

const tabButtons = [
  { tab: 'docs', icon: 'text', title: 'Documentation Editor' },
  { tab: 'help', icon: 'help', title: 'Component Help' },
] as const satisfies TabButton[]
const isFullscreen = ref(false)

const mainMarkdownDocs = new Y.Doc().getText() // TODO
</script>

<template>
  <DockPanel
    v-model:size="dockStore.width"
    :show="dockStore.visible"
    :tab="dockStore.displayedTab"
    :tabButtons="tabButtons"
    :contentFullscreen="isFullscreen"
    @update:show="dockStore.setVisible"
    @update:tab="dockStore.switchToTab"
  >
    <template #tab-docs>
      <DocumentationEditor
        v-if="mainMarkdownDocs"
        ref="docEditor"
        :yText="mainMarkdownDocs"
        @update:fullscreen="isFullscreen = $event"
      >
        <template #belowToolbar>
          <FunctionSignatureEditor
            v-if="dockStore.inspectedAst"
            :functionAst="dockStore.inspectedAst"
          />
        </template>
      </DocumentationEditor>
    </template>
    <template #tab-help>
      <ComponentDocumentation v-model="displayedDocsSuggestion" :aiMode="props.aiMode" />
    </template>
  </DockPanel>
</template>
