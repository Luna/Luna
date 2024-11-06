<script setup lang="ts">
import EditorRoot from '@/components/codemirror/EditorRoot.vue'
import { highlightStyle } from '@/components/MarkdownEditor/highlight'
import { ensoMarkdown } from '@/components/MarkdownEditor/markdown'
import VueComponentHost, { VueHost } from '@/components/VueComponentHost.vue'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { minimalSetup } from 'codemirror'
import { type ComponentInstance, onMounted, ref, toRef, useCssModule, watch } from 'vue'

const editorRoot = ref<ComponentInstance<typeof EditorRoot>>()

const props = defineProps<{
  source: string
}>()

const vueHost = ref<ComponentInstance<typeof VueComponentHost>>()

const editorView = new EditorView()
const constantExtensions = [minimalSetup, highlightStyle(useCssModule()), EditorView.lineWrapping]

watch([vueHost, toRef(props, 'source')], ([vueHost, source]) => {
  if (!vueHost) return
  editorView.setState(
    EditorState.create({
      doc: source,
      extensions: [...constantExtensions, ensoMarkdown({ vueHost })],
    }),
  )
})

onMounted(() => {
  const content = editorView.dom.getElementsByClassName('cm-content')[0]!
  content.addEventListener('focusin', () => (editing.value = true))
  editorRoot.value?.rootElement?.prepend(editorView.dom)
})

const editing = ref(false)
</script>

<template>
  <EditorRoot
    ref="editorRoot"
    class="MarkdownEditor"
    :class="{ editing }"
    @focusout="editing = false"
  />
  <VueComponentHost ref="vueHost" />
</template>

<style scoped>
:deep(.cm-content) {
  font-family: var(--font-sans);
}

:deep(.cm-scroller) {
  /* Prevent touchpad back gesture, which can be triggered while panning. */
  overscroll-behavior: none;
}

:deep(.cm-editor) {
  position: relative;
  width: 100%;
  height: 100%;
  opacity: 1;
  color: black;
  font-size: 12px;
  outline: none;
}

:deep(.cm-line) {
  padding-right: 6px;
}
</style>

<!--suppress CssUnusedSymbol -->
<style module>
/* === Syntax styles === */

.processingInstruction {
  opacity: 20%;
}
.emphasis:not(.processingInstruction) {
  font-style: italic;
}
.strong:not(.processingInstruction) {
  font-weight: bold;
}
.strikethrough:not(.processingInstruction) {
  text-decoration: line-through;
}
.monospace {
  /*noinspection CssNoGenericFontName*/
  font-family: var(--font-mono);
}

/* === Editing-mode === */

/* There are currently no style overrides for editing mode, so this is commented out to appease the Vue linter. */
/* :global(.MarkdownEditor):global(.editing) :global(.cm-line):global(.cm-has-cursor) {} */

/* === View-mode === */

:global(.MarkdownEditor):not(:global(.editing)) :global(.cm-line),
:global(.cm-line):not(:global(.cm-has-cursor)) {
  :global(.cm-image-markup) {
    display: none;
  }
  .processingInstruction {
    display: none;
  }
  .url {
    display: none;
  }
  a > .link {
    display: inline;
    cursor: pointer;
    color: #555;
    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
