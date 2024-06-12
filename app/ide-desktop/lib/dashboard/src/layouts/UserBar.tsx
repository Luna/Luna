/** @file A toolbar containing chat and the user menu. */
import * as React from 'react'

import ChatIcon from 'enso-assets/chat.svg'
import DefaultUserIcon from 'enso-assets/default_user.svg'

import * as appUtils from '#/appUtils'

import * as authProvider from '#/providers/AuthProvider'
import * as backendProvider from '#/providers/BackendProvider'
import * as modalProvider from '#/providers/ModalProvider'
import * as textProvider from '#/providers/TextProvider'

import * as pageSwitcher from '#/layouts/PageSwitcher'
import UserMenu from '#/layouts/UserMenu'

import * as aria from '#/components/aria'
import * as ariaComponents from '#/components/AriaComponents'
import FocusArea from '#/components/styled/FocusArea'

import InviteUsersModal from '#/modals/InviteUsersModal'
import ManagePermissionsModal from '#/modals/ManagePermissionsModal'

import * as backendModule from '#/services/Backend'
import type Backend from '#/services/Backend'

// ===============
// === UserBar ===
// ===============

/** Props for a {@link UserBar}. */
export interface UserBarProps {
  /** When `true`, the element occupies space in the layout but is not visible.
   * Defaults to `false`. */
  readonly invisible?: boolean
  readonly page: pageSwitcher.Page
  readonly setPage: (page: pageSwitcher.Page) => void
  readonly setIsHelpChatOpen: (isHelpChatOpen: boolean) => void
  readonly projectAsset: backendModule.ProjectAsset | null
  readonly setProjectAsset: React.Dispatch<React.SetStateAction<backendModule.ProjectAsset>> | null
  readonly doRemoveSelf: () => void
  readonly onSignOut: () => void
}

/** A toolbar containing chat and the user menu. */
export default function UserBar(props: UserBarProps) {
  const { invisible = false, page, setPage, setIsHelpChatOpen } = props
  const { projectAsset, setProjectAsset, doRemoveSelf, onSignOut } = props
  const { type: sessionType, user } = authProvider.useNonPartialUserSession()
  const { setModal, updateModal } = modalProvider.useSetModal()
  const { getText } = textProvider.useText()
  const backend = backendProvider.useRemoteBackend()
  const self =
    user != null
      ? projectAsset?.permissions?.find(
          backendModule.isUserPermissionAnd(permissions => permissions.user.userId === user.userId)
        ) ?? null
      : null
  const shouldShowShareButton =
    backend != null &&
    page === pageSwitcher.Page.editor &&
    projectAsset != null &&
    setProjectAsset != null &&
    self != null
  const shouldShowInviteButton =
    backend != null && sessionType === authProvider.UserSessionType.full && !shouldShowShareButton

  return (
    <FocusArea active={!invisible} direction="horizontal">
      {innerProps => (
        <div
          className="pr-profile-picture pointer-events-auto flex h-row shrink-0 cursor-default items-center gap-1 rounded-full bg-frame px-icons-x backdrop-blur-default"
          {...innerProps}
        >
          <ariaComponents.Button
            variant="icon"
            size="custom"
            className="mr-1"
            icon={ChatIcon}
            aria-label={getText('openHelpChat')}
            onPress={() => {
              setIsHelpChatOpen(true)
            }}
          />

          {shouldShowInviteButton && (
            <ariaComponents.DialogTrigger>
              <ariaComponents.Button rounded="full" size="small" variant="tertiary">
                {getText('invite')}
              </ariaComponents.Button>

              <InviteUsersModal />
            </ariaComponents.DialogTrigger>
          )}

          <ariaComponents.Button
            variant="primary"
            rounded="full"
            size="small"
            href={appUtils.SUBSCRIBE_PATH}
          >
            {getText('upgrade')}
          </ariaComponents.Button>
          {shouldShowShareButton && (
            <ariaComponents.Button
              size="custom"
              variant="custom"
              className="text my-auto rounded-full bg-share px-button-x text-inversed"
              aria-label={getText('shareButtonAltText')}
              onPress={() => {
                setModal(
                  <ManagePermissionsModal
                    backend={backend}
                    item={projectAsset}
                    setItem={setProjectAsset}
                    self={self}
                    doRemoveSelf={doRemoveSelf}
                    eventTarget={null}
                  />
                )
              }}
            >
              <aria.Text slot="label">{getText('share')}</aria.Text>
            </ariaComponents.Button>
          )}
          <ariaComponents.Button
            size="custom"
            variant="custom"
            className="size-profile-picture flex select-none items-center overflow-clip rounded-full"
            aria-label={getText('userMenuAltText')}
            onPress={() => {
              updateModal(oldModal =>
                oldModal?.type === UserMenu ? null : (
                  <UserMenu setPage={setPage} onSignOut={onSignOut} />
                )
              )
            }}
          >
            <img
              src={user?.profilePicture ?? DefaultUserIcon}
              alt={getText('openUserMenu')}
              className="pointer-events-none"
              height={28}
              width={28}
            />
          </ariaComponents.Button>
          {/* Required for shortcuts to work. */}
          <div className="hidden">
            <UserMenu hidden setPage={setPage} onSignOut={onSignOut} />
          </div>
        </div>
      )}
    </FocusArea>
  )
}
