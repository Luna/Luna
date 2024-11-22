import { createContextStore } from '@/providers'
import { type Icon } from '@/util/iconName'
import {
  computed,
  type ComputedRef,
  markRaw,
  MaybeRef,
  proxyRefs,
  Ref,
  unref,
  type UnwrapRef,
} from 'vue'

type ActionOrStateRequired = { action: () => void } | { state: Ref<boolean> }

interface ComputedComponentActionControl {
  action?: (() => void) | undefined
  state?: Ref<boolean> | undefined
  hidden?: ComputedRef<boolean> | undefined
  disabled?: ComputedRef<boolean> | undefined
}
interface ComputedComponentActionInterface {
  icon: Icon
  description: ComputedRef<string> | string
  shortcut?: string | undefined
  testid?: string | undefined
}
interface ComputedComponentAction
  extends ComputedComponentActionControl,
    ComputedComponentActionInterface {}

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

type ComponentActionInputs<T> = Omit<ComputedComponentAction, 'shortcut'> & {
  shortcut?: { humanReadable: string }
} & {
  actionData?: T
} & (T extends void ? unknown
  : {
      actionData: T
    })

export function componentAction<T = void>(
  inputs: ComponentActionInputs<T> & ComputedStateful,
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

type ActionsWithVoidActionData =
  | 'enterNode'
  | 'startEditing'
  | 'editingComment'
  | 'createNewNode'
  | 'toggleDocPanel'
  | 'toggleVisualization'
  | 'recompute'
type Actions = ActionsWithVoidActionData | 'pickColor'

type ComputedStateful = { state: Ref<boolean> }
type Stateful = { state: boolean }

type ComputedPickColorData = {
  currentColor: Ref<string | undefined>
  matchableColors: Readonly<Ref<ReadonlySet<string>>>
}
type PickColorData = UnwrapRef<ComputedPickColorData>

export type ComponentActions = Record<ActionsWithVoidActionData, ComponentAction<void>> &
  Record<'toggleVisualization' | 'pickColor', Stateful> &
  Record<'pickColor', ComponentAction<PickColorData>>

function useComponentActions(
  {
    graphBindings,
    nodeEditBindings,
    onBeforeAction,
  }: {
    graphBindings: Record<'openComponentBrowser' | 'toggleVisualization', { humanReadable: string }>
    nodeEditBindings: Record<'edit', { humanReadable: string }>
    onBeforeAction: () => void
  },
  actions: Record<Actions, ComputedComponentActionControl & ActionOrStateRequired> &
    Record<'toggleVisualization' | 'pickColor', ComputedStateful> & {
      pickColor: { actionData: ComputedPickColorData }
    },
): ComponentActions {
  function withHooks<T extends { action?: (() => void) | undefined }>(value: T): T {
    return {
      ...value,
      action:
        value.action ?
          () => {
            onBeforeAction()
            value.action?.()
          }
        : onBeforeAction,
    }
  }
  return {
    enterNode: componentAction({
      ...withHooks(actions.enterNode),
      icon: 'open',
      description: 'Open Grouped Components',
      testid: 'enter-node-button',
    }),
    startEditing: componentAction({
      ...withHooks(actions.startEditing),
      icon: 'edit',
      description: 'Code Edit',
      shortcut: nodeEditBindings.edit,
      testid: 'edit-button',
    }),
    editingComment: componentAction({
      ...withHooks(actions.editingComment),
      icon: 'comment',
      description: 'Add Comment',
    }),
    createNewNode: componentAction({
      ...withHooks(actions.createNewNode),
      icon: 'add',
      description: 'Add New Component',
      shortcut: graphBindings.openComponentBrowser,
    }),
    toggleDocPanel: componentAction({
      ...withHooks(actions.toggleDocPanel),
      icon: 'help',
      description: 'Help',
    }),
    toggleVisualization: componentAction({
      ...withHooks(actions.toggleVisualization),
      icon: 'eye',
      description: computed(() =>
        actions.toggleVisualization.state.value ? 'Hide Visualization' : 'Show Visualization',
      ),
      shortcut: graphBindings.toggleVisualization,
    }),
    recompute: componentAction({
      ...withHooks(actions.recompute),
      icon: 'workflow_play',
      description: 'Write',
      testid: 'recompute',
    }),
    pickColor: componentAction({
      ...withHooks(actions.pickColor),
      icon: 'paint_palette',
      description: 'Color Component',
      actionData: proxyRefs(actions.pickColor.actionData),
    }),
  }
}

export { injectFn as injectComponentActions, provideFn as provideComponentActions }
const { provideFn, injectFn } = createContextStore('Component actions', useComponentActions)
