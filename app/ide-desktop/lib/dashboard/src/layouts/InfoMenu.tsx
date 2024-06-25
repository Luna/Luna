/** @file A menu containing info about the app. */
import * as React from 'react'

import LogoIcon from 'enso-assets/enso_logo.svg'
import * as common from 'enso-common'

import * as authProvider from '#/providers/AuthProvider'
import * as modalProvider from '#/providers/ModalProvider'
import * as textProvider from '#/providers/TextProvider'

import * as aria from '#/components/aria'
import MenuEntry from '#/components/MenuEntry'
import Modal from '#/components/Modal'
import FocusArea from '#/components/styled/FocusArea'
import SvgMask from '#/components/SvgMask'

import AboutModal from '#/modals/AboutModal'

import * as tailwindMerge from '#/utilities/tailwindMerge'

// ================
// === InfoMenu ===
// ================

/** Props for an {@link InfoMenu}. */
export interface InfoMenuProps {
  readonly hidden?: boolean
}

/** A menu containing info about the app. */
export default function InfoMenu(props: InfoMenuProps) {
  const { hidden = false } = props
  const { signOut } = authProvider.useAuth()
  const { setModal } = modalProvider.useSetModal()
  const { getText } = textProvider.useText()
  const [initialized, setInitialized] = React.useState(false)

  React.useLayoutEffect(() => {
    // Change the CSS from the initial state to the final state after the first render.
    // This ensures that the CSS transition triggers.
    setInitialized(true)
  }, [])

  return (
    <Modal hidden={hidden} className="absolute size-full overflow-hidden bg-dim">
      <div
        {...(!hidden ? { 'data-testid': 'info-menu' } : {})}
        className={tailwindMerge.twMerge(
          'absolute right-2.5 top-2.5 flex flex-col gap-user-menu rounded-default bg-selected-frame backdrop-blur-default transition-all duration-user-menu',
          initialized ? 'w-user-menu p-user-menu' : 'size-row-h'
        )}
        onClick={event => {
          event.stopPropagation()
        }}
      >
        <div
          className={tailwindMerge.twMerge(
            'flex items-center gap-icons overflow-hidden transition-all duration-user-menu',
            initialized && 'px-menu-entry'
          )}
        >
          <SvgMask src={LogoIcon} className="pointer-events-none h-7 w-7" />
          <aria.Text className="text">{common.PRODUCT_NAME}</aria.Text>
        </div>
        <div
          className={tailwindMerge.twMerge(
            'grid transition-all duration-user-menu',
            initialized ? 'grid-rows-1fr' : 'grid-rows-0fr'
          )}
        >
          <FocusArea direction="vertical">
            {innerProps => (
              <div
                aria-label={getText('infoMenuLabel')}
                className="flex flex-col overflow-hidden"
                {...innerProps}
              >
                <MenuEntry
                  action="aboutThisApp"
                  doAction={() => {
                    setModal(<AboutModal />)
                  }}
                />
                <MenuEntry action="signOut" doAction={signOut} />
              </div>
            )}
          </FocusArea>
        </div>
      </div>
    </Modal>
  )
}
