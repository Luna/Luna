import { createContextStore } from '@/providers'
import {
  type ActionOrStateRequired,
  componentAction,
  type ComponentAction,
  type ComponentActionControl,
  type Stateful,
  type StatefulInput,
} from '@/util/componentActions'
import { computed, proxyRefs, type Ref, type UnwrapRef } from 'vue'

type Actions =
  | 'enterNode'
  | 'startEditing'
  | 'editingComment'
  | 'createNewNode'
  | 'toggleDocPanel'
  | 'toggleVisualization'
  | 'recompute'
  | 'pickColor'

type ActionsWithVoidActionData = Exclude<Actions, 'pickColor'>
type StatefulActions = 'toggleVisualization' | 'pickColor' | 'editingComment'

type PickColorDataInput = {
  currentColor: Ref<string | undefined>
  matchableColors: Readonly<Ref<ReadonlySet<string>>>
}
type PickColorData = UnwrapRef<PickColorDataInput>

export type SingleComponentActions = Record<ActionsWithVoidActionData, ComponentAction<void>> &
  Record<'pickColor', ComponentAction<PickColorData>> &
  Record<StatefulActions, Stateful>

/**
 * Given the {@link ComponentActionControl} for each single-component action and some context, adds the UI information
 * to each action and constructs a set of {@link ComponentAction}s.
 */
function useSingleComponentActions(
  {
    graphBindings,
    nodeEditBindings,
    onBeforeAction,
  }: {
    graphBindings: Record<'openComponentBrowser' | 'toggleVisualization', { humanReadable: string }>
    nodeEditBindings: Record<'edit', { humanReadable: string }>
    onBeforeAction: () => void
  },
  actions: Record<Actions, ComponentActionControl & ActionOrStateRequired> &
    Record<StatefulActions, StatefulInput> & {
      pickColor: { actionData: PickColorDataInput }
    },
): SingleComponentActions {
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

export { injectFn as injectSingleComponentActions, provideFn as provideSingleComponentActions }
const { provideFn, injectFn } = createContextStore(
  'Single component actions',
  useSingleComponentActions,
)
