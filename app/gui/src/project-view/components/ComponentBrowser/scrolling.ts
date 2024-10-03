import { useApproach } from '@/composables/animation'
import { ToValue } from '@/util/reactivity'
import { computed, ref, toValue } from 'vue'

export type ScrollTarget =
  | { type: 'top' }
  | { type: 'selected' }
  | { type: 'offset'; offset: number }

export function useScrolling(selectedPos: ToValue<number>) {
  const targetScroll = ref<ScrollTarget>({ type: 'top' })
  const targetScrollPosition = computed(() => {
    switch (targetScroll.value.type) {
      case 'selected':
        return toValue(selectedPos)
      case 'top':
        return 0.0
      case 'offset':
        return targetScroll.value.offset
    }
    return 0.0
  })
  const scrollTransitionTarget = ref(0.0)
  const scrollTransition = useApproach(scrollTransitionTarget)
  const scrollPosition = computed(() => targetScrollPosition.value + scrollTransition.value)

  function scrollWithTransition(target: ScrollTarget) {
    const old = scrollPosition.value
    targetScroll.value = target
    const change = scrollPosition.value - old
    scrollTransitionTarget.value = -change
    scrollTransition.skip()
    scrollTransitionTarget.value = 0.0
  }

  return {
    targetScroll,
    scrollPosition,
    scrollWithTransition,
  }
}
