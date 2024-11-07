<script setup lang="ts">
import type { UrlTransformer } from '@/components/MarkdownEditor/imageUrlTransformer'
import { ComponentInstance, computed, defineAsyncComponent, ref } from 'vue'
import * as Y from 'yjs'

const props = defineProps<{
  yText: Y.Text
  transformImageUrl?: UrlTransformer
  toolbarContainer: HTMLElement | undefined
}>()

const inner = ref<ComponentInstance<typeof LazyMarkdownEditor>>()

const LazyMarkdownEditor = defineAsyncComponent(
  () => import('@/components/MarkdownEditor/MarkdownEditorImpl.vue'),
)

defineExpose({
  loaded: computed(() => inner.value != null),
  putText: (text: string) => {
    inner.value?.putText(text)
  },
})
</script>

<template>
  <Suspense>
    <LazyMarkdownEditor ref="inner" v-bind="props" />
  </Suspense>
</template>
