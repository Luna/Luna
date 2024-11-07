<script setup lang="ts">
import { documentationEditorBindings } from '@/bindings'
import FullscreenButton from '@/components/FullscreenButton.vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import { fetcherUrlTransformer } from '@/components/MarkdownEditor/imageUrlTransformer'
import WithFullscreenMode from '@/components/WithFullscreenMode.vue'
import { useGraphStore } from '@/stores/graph'
import { useProjectStore } from '@/stores/project'
import type { ToValue } from '@/util/reactivity'
import { useToast } from '@/util/toast'
import { ComponentInstance, ref, toRef, toValue, watch } from 'vue'
import type { Path } from 'ydoc-shared/languageServerTypes'
import { Err, Ok, mapOk, withContext, type Result } from 'ydoc-shared/util/data/result'
import * as Y from 'yjs'

const { yText } = defineProps<{
  yText: Y.Text
}>()
const emit = defineEmits<{
  'update:fullscreen': [boolean]
}>()

const toolbarElement = ref<HTMLElement>()
const markdownEditor = ref<ComponentInstance<typeof MarkdownEditor>>()

const graphStore = useGraphStore()
const projectStore = useProjectStore()
const { transformImageUrl, uploadImage } = useDocumentationImages(
  toRef(graphStore, 'modulePath'),
  // TODO: is this needed?
  projectStore.readFileBinary,
)
const uploadErrorToast = useToast.error()

function useDocumentationImages(
  modulePath: ToValue<Path | undefined>,
  readFileBinary: (path: Path) => Promise<Result<Blob>>,
) {
  async function urlToPath(url: string): Promise<Result<Path> | undefined> {
    const modulePathValue = toValue(modulePath)
    if (!modulePathValue) {
      return Err('Current module path is unknown.')
    }
    const appliedUrl = new URL(url, `file:///${modulePathValue.segments.join('/')}`)
    if (appliedUrl.protocol === 'file:') {
      const segments = appliedUrl.pathname.split('/')
      return Ok({ rootId: modulePathValue.rootId, segments })
    } else {
      // Not a relative URL, custom fetching not needed.
      return undefined
    }
  }

  function pathUniqueId(path: Path) {
    return path.rootId + ':' + path.segments.join('/')
  }

  function pathDebugRepr(path: Path) {
    return pathUniqueId(path)
  }

  const uploadedImages = new Map<string, Promise<Blob>>()

  const transformImageUrl = fetcherUrlTransformer(
    async (url: string) => {
      const path = await urlToPath(url)
      if (!path) return
      return withContext(
        () => `Locating documentation image (${url})`,
        () => mapOk(path, (path) => ({ location: path, uniqueId: pathUniqueId(path) })),
      )
    },
    async (path) => {
      return withContext(
        () => `Loading documentation image (${pathDebugRepr(path)})`,
        () => {
          const uploaded = uploadedImages.get(pathUniqueId(path))
          return uploaded?.then((blob) => Ok(blob)) ?? readFileBinary(path)
        },
      )
    },
  )

  function uploadImage(name: string, blob: Promise<Blob>) {
    if (!markdownEditor.value || !markdownEditor.value.loaded) {
      console.error('Tried to upload image while mardown editor is still not loaded')
      return
    }
    // TODO: check for name conflicts.
    markdownEditor.value.putText(`![Image](/images/${name})`)
    projectStore.projectRootId.then((rootId) => {
      if (!rootId) {
        uploadErrorToast.show('Cannot upload image: unknown project file tree root.')
        return
      }
      const path: Path = {
        rootId,
        segments: ['images', name],
      }
      const id = pathUniqueId(path)
      uploadedImages.set(id, blob)
      blob
        .then(async (blob) => {
          const result = await projectStore.writeFileBinary(path, blob)
          if (!result.ok) uploadErrorToast.reportError(result.error, 'Failed to upload image')
        })
        .catch((err) => uploadErrorToast.show(`Failed to upload image: ${err}`))
        .finally(() => uploadedImages.delete(id))
    })
  }

  return { transformImageUrl, uploadImage }
}

const fullscreen = ref(false)
const fullscreenAnimating = ref(false)

watch(
  () => fullscreen.value || fullscreenAnimating.value,
  (fullscreenOrAnimating) => emit('update:fullscreen', fullscreenOrAnimating),
)

const handler = documentationEditorBindings.handler({
  pasteImage: () => {
    window.navigator.clipboard.read().then(async (items) => {
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith('image/'))
        if (imageType) {
          // TODO: better extensions
          const ext = imageType.slice('image/'.length)
          uploadImage(`image${ext}`, item.getType(imageType))
          break
        }
      }
    })
  },
})
</script>

<template>
  <WithFullscreenMode :fullscreen="fullscreen" @update:animating="fullscreenAnimating = $event">
    <div class="DocumentationEditor">
      <div ref="toolbarElement" class="toolbar">
        <FullscreenButton v-model="fullscreen" />
      </div>
      <div class="scrollArea">
        <MarkdownEditor
          ref="markdownEditor"
          :yText="yText"
          :transformImageUrl="transformImageUrl"
          :toolbarContainer="toolbarElement"
          @keydown="handler"
        />
      </div>
    </div>
  </WithFullscreenMode>
</template>

<style scoped>
.DocumentationEditor {
  display: flex;
  flex-direction: column;
  background-color: #fff;
  height: 100%;
  width: 100%;
}

.scrollArea {
  width: 100%;
  overflow-y: auto;
  padding-left: 10px;
  /* Prevent touchpad back gesture, which can be triggered while panning. */
  overscroll-behavior-x: none;
  flex-grow: 1;
}

.toolbar {
  height: 48px;
  padding-left: 16px;
  flex-shrink: 0;

  display: flex;
  align-items: center;
  flex-direction: row;
  gap: 8px;
}
</style>
