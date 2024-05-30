/** @file A row of the user groups table representing a user. */
import * as React from 'react'

import Cross2 from 'enso-assets/cross2.svg'

import * as contextMenuHooks from '#/hooks/contextMenuHooks'

import * as modalProvider from '#/providers/ModalProvider'
import * as textProvider from '#/providers/TextProvider'

import * as aria from '#/components/aria'
import * as ariaComponents from '#/components/AriaComponents'
import ContextMenuEntry from '#/components/ContextMenuEntry'
import UnstyledButton from '#/components/UnstyledButton'

import ConfirmDeleteModal from '#/modals/ConfirmDeleteModal'

import type * as backend from '#/services/Backend'

// ========================
// === UserGroupUserRow ===
// ========================

/** Props for a {@link UserGroupUserRow}. */
export interface UserGroupUserRowProps {
  readonly user: backend.User
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
      className="group h-row rounded-rows-child"
      ref={contextMenuRef}
    >
      <aria.Cell className="border-x-2 border-transparent bg-clip-padding rounded-rows-skip-level last:border-r-0">
        <div className="flex justify-center">
          <ariaComponents.Text nowrap truncate="1" weight="semibold">
            {user.name}
          </ariaComponents.Text>
        </div>
      </aria.Cell>
      <aria.Cell className="relative bg-transparent p transparent group-hover-2:opacity-100">
        <UnstyledButton
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
          className="absolute right-full mr-4 size-icon -translate-y-1/2"
        >
          <img src={Cross2} className="size-icon" />
        </UnstyledButton>
      </aria.Cell>
    </aria.Row>
  )
}
