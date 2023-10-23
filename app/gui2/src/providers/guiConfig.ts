import { identity } from '@vueuse/core'
import { type Ref } from 'vue'
import { createContextStore } from '.'

export interface GuiConfig {
  engine?: {
    projectManagerUrl?: string
    preferredVersion?: string
    rpcUrl?: string
    dataUrl?: string
    namespace?: string
  }
  startup?: {
    project?: string
  }
  window?: { topBarOffset?: string }
}
export { injectFn as injectGuiConfig, provideFn as provideGuiConfig }
const { provideFn, injectFn } = createContextStore(identity<Ref<GuiConfig>>)
