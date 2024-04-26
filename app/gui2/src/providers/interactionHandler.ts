import { createContextStore } from '@/providers'
import type { GraphNavigator } from '@/providers/graphNavigator'
import { watch, type WatchSource } from 'vue'

export { injectFn as injectInteractionHandler, provideFn as provideInteractionHandler }
const { provideFn, injectFn } = createContextStore(
  'Interaction handler',
  () => new InteractionHandler(),
)

export class InteractionHandler {
  private currentInteraction: Interaction | undefined = undefined

  isActive(interaction: Interaction | undefined): interaction is Interaction {
    return interaction != null && interaction === this.currentInteraction
  }

  /** Automatically activate specified interaction any time a specified condition becomes true. */
  setWhen(active: WatchSource<boolean>, interaction: Interaction) {
    watch(active, (active) => {
      if (active) {
        this.setCurrent(interaction)
      } else {
        this.end(interaction)
      }
    })
  }

  setCurrent(interaction: Interaction | undefined) {
    if (!this.isActive(interaction)) {
      this.currentInteraction?.cancel?.()
      this.currentInteraction = interaction
    }
  }

  getCurrent(): Interaction | undefined {
    return this.currentInteraction
  }

  /** Unset the current interaction, if it is the specified instance. */
  end(interaction: Interaction) {
    if (this.isActive(interaction)) this.currentInteraction = undefined
  }

  /** Cancel the current interaction, if it is the specified instance. */
  cancel(interaction: Interaction) {
    if (this.isActive(interaction)) this.setCurrent(undefined)
  }

  handleCancel(): boolean {
    const hasCurrent = this.currentInteraction != null
    if (hasCurrent) this.setCurrent(undefined)
    return hasCurrent
  }

  handlePointerDown(event: PointerEvent, graphNavigator: GraphNavigator): boolean {
    if (!this.currentInteraction?.pointerdown) return false
    const handled = this.currentInteraction.pointerdown(event, graphNavigator) !== false
    if (handled) {
      event.stopImmediatePropagation()
      event.preventDefault()
    }
    return handled
  }
}

export interface Interaction {
  cancel(): void
  /** Uses a `capture` event handler to allow an interaction to respond to clicks over any element. */
  pointerdown?(event: PointerEvent, navigator: GraphNavigator): boolean | void
}
