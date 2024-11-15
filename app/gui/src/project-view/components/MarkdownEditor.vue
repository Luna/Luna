<script setup lang="ts">
import {
  provideDocumentationImageUrlTransformer,
  UrlTransformer,
} from '@/components/MarkdownEditor/imageUrlTransformer'
import { defineAsyncComponent, toRef } from 'vue'
import * as Y from 'yjs'

const props = defineProps<{
  content: Y.Text | string
  transformImageUrl?: UrlTransformer
  toolbarContainer: HTMLElement | undefined
}>()

const LazyMarkdownEditor = defineAsyncComponent(
  () => import('@/components/MarkdownEditor/MarkdownEditorImpl.vue'),
)

provideDocumentationImageUrlTransformer(toRef(props, 'transformImageUrl'))
</script>

<template>
  <Suspense>
    <LazyMarkdownEditor v-bind="props" />
  </Suspense>
</template>
