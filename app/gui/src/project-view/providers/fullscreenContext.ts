import { createContextStore } from '@/providers'
import type { Ref } from 'vue'

export const [provideFullscreenContext, useFullscreenContext] = createContextStore(
  'fullscreen context',
  (fullscreenContainer: Readonly<Ref<HTMLElement | undefined>>) => ({
    /** An element that fullscreen elements should be placed inside. */
    fullscreenContainer,
  }),
)
