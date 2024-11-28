import { type Icon } from '@/util/iconName'
import { computed, type ComputedRef, markRaw, type MaybeRef, type Ref, unref } from 'vue'

export type ActionOrStateRequired = { action: () => void } | { state: Ref<boolean> }

export interface ComponentActionControl {
  action?: (() => void) | undefined
  state?: Ref<boolean> | undefined
  hidden?: ComputedRef<boolean> | undefined
  disabled?: ComputedRef<boolean> | undefined
}
export interface ComponentActionInterface {
  icon: Icon
  description: ComputedRef<string> | string
  shortcut?: string | undefined
  testid?: string | undefined
}

export interface ComponentAction<T = unknown> extends ComponentActionImpl<T> {}

class ComponentActionImpl<T> {
  private readonly toDescriptionWithShortcut: MaybeRef<string>
  constructor(
    readonly action: (() => void) | undefined,
    readonly icon: Icon,
    readonly shortcut: string | undefined,
    readonly testid: string | undefined,
    readonly actionData: T,
    private readonly toDescription: MaybeRef<string>,
    private readonly toHidden: Readonly<Ref<boolean>> | undefined,
    private readonly toDisabled: Readonly<Ref<boolean>> | undefined,
    private readonly refState: Ref<boolean> | undefined,
  ) {
    markRaw(this)
    this.toDescriptionWithShortcut =
      shortcut ? computed(() => `${unref(toDescription)} (${shortcut})`) : toDescription
  }
  get description(): string {
    return unref(this.toDescription)
  }
  get descriptionWithShortcut(): string {
    return unref(this.toDescriptionWithShortcut)
  }
  get hidden(): boolean {
    return this.toHidden ? unref(this.toHidden) : false
  }
  get disabled(): boolean {
    return this.toDisabled ? unref(this.toDisabled) : false
  }
  get state(): boolean | undefined {
    return this.refState && unref(this.refState)
  }
  set state(state: boolean) {
    if (this.refState) this.refState.value = state
  }
}

type ComponentActionInputs<T> = Omit<
  ComponentActionControl & ComponentActionInterface,
  'shortcut'
> & {
  shortcut?: { humanReadable: string }
} & {
  actionData?: T
} & (T extends void ? unknown
  : {
      actionData: T
    })

export interface StatefulInput {
  state: Ref<boolean>
}
export interface Stateful {
  state: boolean
}

export function componentAction<T = void>(
  inputs: ComponentActionInputs<T> & StatefulInput,
): ComponentAction<T> & Stateful
export function componentAction<T = void>(inputs: ComponentActionInputs<T>): ComponentAction<T>
/** Create a {@link ComponentAction}. */
export function componentAction<T = void>(inputs: ComponentActionInputs<T>): ComponentAction<T> {
  return new ComponentActionImpl<T>(
    inputs.action,
    inputs.icon,
    inputs.shortcut?.humanReadable,
    inputs.testid,
    inputs.actionData as T,
    inputs.description,
    inputs.hidden,
    inputs.disabled,
    inputs.state,
  )
}
