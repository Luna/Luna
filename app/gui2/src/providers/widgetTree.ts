import type { Ast } from '@/util/ast/abstract'
import { computed, proxyRefs, type Ref } from 'vue'
import { createContextStore } from '.'

export { injectFn as injectWidgetTree, provideFn as provideWidgetTree }
const { provideFn, injectFn } = createContextStore(
  'Widget tree',
  (astRoot: Ref<Ast>, hasActiveAnimations: Ref<boolean>) => {
    const nodeId = computed(() => astRoot.value.exprId)
    const nodeSpanStart = computed(() => astRoot.value.span.start)
    return proxyRefs({ astRoot, nodeId, nodeSpanStart, hasActiveAnimations })
  },
)
