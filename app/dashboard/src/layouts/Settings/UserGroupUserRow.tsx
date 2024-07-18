/** @file A row of the user groups table representing a user. */
import * as React from 'react'

import Cross2 from '#/assets/cross2.svg'

import type * as backendHooks from '#/hooks/backendHooks'
import * as contextMenuHooks from '#/hooks/contextMenuHooks'

import * as modalProvider from '#/providers/ModalProvider'
import * as textProvider from '#/providers/TextProvider'

import * as aria from '#/components/aria'
import * as ariaComponents from '#/components/AriaComponents'
import ContextMenuEntry from '#/components/ContextMenuEntry'

import ConfirmDeleteModal from '#/modals/ConfirmDeleteModal'

import type * as backend from '#/services/Backend'

import * as tailwindMerge from '#/utilities/tailwindMerge'

// ========================
// === UserGroupUserRow ===
// ========================

/** Props for a {@link UserGroupUserRow}. */
export interface UserGroupUserRowProps {
  readonly user: backendHooks.WithPlaceholder<backend.User>
  readonly userGroup: backend.UserGroupInfo
  readonly doRemoveUserFromUserGroup: (user: backend.User, userGroup: backend.UserGroupInfo) => void
}

/** A row of the user groups table representing a user. */
export default function UserGroupUserRow(props: UserGroupUserRowProps) {
  const { user, userGroup, doRemoveUserFromUserGroup } = props
  const { setModal } = modalProvider.useSetModal()
  const { getText } = textProvider.useText()
  const contextMenuRef = contextMenuHooks.useContextMenuRef(
    user.userId,
    getText('userGroupUserContextMenuLabel'),
    position => (
      <ContextMenuEntry
        action="delete"
        doAction={() => {
          setModal(
            <ConfirmDeleteModal
              event={position}
              actionText={getText(
                'removeUserFromUserGroupActionText',
                user.name,
                userGroup.groupName
              )}
              doDelete={() => {
                doRemoveUserFromUserGroup(user, userGroup)
              }}
            />
          )
        }}
      />
    )
  )

  return (
    <aria.Row
      id={`_key-${userGroup.id}-${user.userId}`}
      className={tailwindMerge.twMerge(
        'group h-row select-none rounded-rows-child',
        user.isPlaceholder && 'pointer-events-none placeholder'
      )}
      ref={contextMenuRef}
    >
      <aria.Cell className="border-x-2 border-transparent bg-clip-padding py-0 rounded-rows-skip-level last:border-r-0">
        <div className="ml-6 flex h-row items-center justify-center rounded-full px-cell-x">
          <ariaComponents.Text nowrap truncate="1" weight="semibold">
            {user.name}
          </ariaComponents.Text>
        </div>
      </aria.Cell>
      <aria.Cell className="relative bg-transparent p-0 opacity-0 group-hover-2:opacity-100">
        <ariaComponents.Button
          size="custom"
          variant="custom"
          onPress={() => {
            setModal(
              <ConfirmDeleteModal
                actionText={getText(
                  'removeUserFromUserGroupActionText',
                  user.name,
                  userGroup.groupName
                )}
                actionButtonLabel={getText('remove')}
                doDelete={() => {
                  doRemoveUserFromUserGroup(user, userGroup)
                }}
              />
            )
          }}
          className="absolute right-full mr-4 size-4 -translate-y-1/2"
        >
          <img src={Cross2} className="size-4" />
        </ariaComponents.Button>
      </aria.Cell>
    </aria.Row>
  )
}
