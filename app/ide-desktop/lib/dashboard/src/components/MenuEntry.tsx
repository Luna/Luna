/** @file An entry in a menu. */
import * as React from 'react'

import * as tailwindVariants from 'tailwind-variants'

import BlankIcon from 'enso-assets/blank.svg'

import type * as text from '#/text'

import type * as inputBindings from '#/configurations/inputBindings'

import * as focusHooks from '#/hooks/focusHooks'

import * as inputBindingsProvider from '#/providers/InputBindingsProvider'
import * as textProvider from '#/providers/TextProvider'

import * as aria from '#/components/aria'
import KeyboardShortcut from '#/components/dashboard/KeyboardShortcut'
import FocusRing from '#/components/styled/FocusRing'
import SvgMask from '#/components/SvgMask'

import * as sanitizedEventTargets from '#/utilities/sanitizedEventTargets'

// =================
// === Constants ===
// =================

const MENU_ENTRY_VARIANTS = tailwindVariants.tv({
  base: 'flex h-row grow place-content-between items-center rounded-inherit p-menu-entry text-left selectable group-enabled:active hover:bg-hover-bg disabled:bg-transparent',
  variants: {
    variant: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'context-menu': 'px-context-menu-entry-x',
    },
  },
})

const ACTION_TO_TEXT_ID: Readonly<Record<inputBindings.DashboardBindingKey, text.TextId>> = {
  settings: 'settingsShortcut',
  open: 'openShortcut',
  run: 'runShortcut',
  close: 'closeShortcut',
  uploadToCloud: 'uploadToCloudShortcut',
  rename: 'renameShortcut',
  edit: 'editShortcut',
  editDescription: 'editDescriptionShortcut',
  snapshot: 'snapshotShortcut',
  delete: 'deleteShortcut',
  undelete: 'undeleteShortcut',
  share: 'shareShortcut',
  label: 'labelShortcut',
  duplicate: 'duplicateShortcut',
  copy: 'copyShortcut',
  cut: 'cutShortcut',
  paste: 'pasteShortcut',
  download: 'downloadShortcut',
  uploadFiles: 'uploadFilesShortcut',
  newProject: 'newProjectShortcut',
  newFolder: 'newFolderShortcut',
  newDatalink: 'newDatalinkShortcut',
  newSecret: 'newSecretShortcut',
  useInNewProject: 'useInNewProjectShortcut',
  closeModal: 'closeModalShortcut',
  cancelEditName: 'cancelEditNameShortcut',
  signIn: 'signInShortcut',
  signOut: 'signOutShortcut',
  downloadApp: 'downloadAppShortcut',
  cancelCut: 'cancelCutShortcut',
  editName: 'editNameShortcut',
  selectAdditional: 'selectAdditionalShortcut',
  selectRange: 'selectRangeShortcut',
  selectAdditionalRange: 'selectAdditionalRangeShortcut',
  goBack: 'goBackShortcut',
  goForward: 'goForwardShortcut',
  aboutThisApp: 'aboutThisAppShortcut',
} satisfies { [Key in inputBindings.DashboardBindingKey]: `${Key}Shortcut` }

// =================
// === MenuEntry ===
// =================

/** Props for a {@link MenuEntry}. */
export interface MenuEntryProps extends tailwindVariants.VariantProps<typeof MENU_ENTRY_VARIANTS> {
  readonly hidden?: boolean
  readonly action: inputBindings.DashboardBindingKey
  /** Overrides the text for the menu entry. */
  readonly label?: string
  /** When true, the button is not clickable. */
  readonly isDisabled?: boolean
  readonly title?: string
  readonly doAction: () => void
}

/** An item in a menu. */
export default function MenuEntry(props: MenuEntryProps) {
  const {
    hidden = false,
    action,
    label,
    isDisabled = false,
    title,
    doAction,
    ...variantProps
  } = props
  const { getText } = textProvider.useText()
  const inputBindings = inputBindingsProvider.useInputBindings()
  const focusChildProps = focusHooks.useFocusChild()
  const info = inputBindings.metadata[action]
  React.useEffect(() => {
    // This is slower (but more convenient) than registering every shortcut in the context menu
    // at once.
    if (isDisabled) {
      return
    } else {
      return inputBindings.attach(sanitizedEventTargets.document.body, 'keydown', {
        [action]: doAction,
      })
    }
  }, [isDisabled, inputBindings, action, doAction])

  return hidden ? null : (
    <FocusRing>
      <aria.Button
        {...aria.mergeProps<aria.ButtonProps>()(focusChildProps, {
          isDisabled,
          className: 'group flex w-full rounded-menu-entry',
          onPress: doAction,
        })}
      >
        <div className={MENU_ENTRY_VARIANTS(variantProps)}>
          <div title={title} className="flex items-center gap-menu-entry whitespace-nowrap">
            <SvgMask src={info.icon ?? BlankIcon} color={info.color} className="size-icon" />
            <aria.Text slot="label">{label ?? getText(ACTION_TO_TEXT_ID[action])}</aria.Text>
          </div>
          <KeyboardShortcut action={action} />
        </div>
      </aria.Button>
    </FocusRing>
  )
}
