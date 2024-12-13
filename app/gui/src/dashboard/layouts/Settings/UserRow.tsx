/** @file A row representing a user in a table of users. */
import type { User } from 'enso-common/src/services/Backend'

import Cross2 from '#/assets/cross2.svg'
import { Button as AriaButton, Cell, FocusRing, Row } from '#/components/aria'
import { Button, DialogTrigger, Text } from '#/components/AriaComponents'
import ContextMenuEntry from '#/components/ContextMenuEntry'
import { useContextMenuRef } from '#/hooks/contextMenuHooks'
import ConfirmDeleteModal from '#/modals/ConfirmDeleteModal'
import { useFullUserSession } from '#/providers/AuthProvider'
import { useSetModal } from '#/providers/ModalProvider'
import { useText } from '#/providers/TextProvider'
import { twMerge } from '#/utilities/tailwindMerge'

/** Props for a {@link UserRow}. */
export interface UserRowProps {
  readonly id: string
  readonly draggable?: boolean
  readonly user: User
  readonly doDeleteUser?: ((user: User) => void) | null
}

/** A row representing a user in a table of users. */
export default function UserRow(props: UserRowProps) {
  const { draggable = false, user, doDeleteUser: doDeleteUserRaw } = props
  const { user: self } = useFullUserSession()
  const { setModal } = useSetModal()
  const { getText } = useText()
  const isAdmin = self.isOrganizationAdmin
  const isSelf = user.userId === self.userId
  const doDeleteUser = isSelf ? null : doDeleteUserRaw

  const contextMenuRef = useContextMenuRef(
    getText('userContextMenuLabel'),
    () =>
      doDeleteUser == null ? null : (
        <ContextMenuEntry
          action="delete"
          doAction={() => {
            setModal(
              <ConfirmDeleteModal
                defaultOpen
                actionText={getText('deleteUserActionText', user.name)}
                doDelete={() => {
                  doDeleteUser(user)
                }}
              />,
            )
          }}
        />
      ),
    { enabled: isAdmin },
  )

  return (
    <Row
      id={user.userId}
      className={twMerge('group h-row rounded-rows-child', draggable && 'cursor-grab')}
      ref={contextMenuRef}
    >
      <Cell className="text relative overflow-hidden whitespace-nowrap border-x-2 border-transparent bg-clip-padding px-cell-x first:rounded-l-full last:rounded-r-full last:border-r-0 group-selected:bg-selected-frame">
        {draggable && (
          <FocusRing>
            <AriaButton
              slot="drag"
              className="absolute left top-1/2 ml-1 h-2 w-2 -translate-y-1/2 rounded-sm"
            />
          </FocusRing>
        )}

        <div className="flex justify-center">
          <Text nowrap truncate="1" weight="semibold">
            {user.name}
          </Text>
        </div>
      </Cell>
      <Cell className="text whitespace-nowrap rounded-r-full border-x-2 border-transparent bg-clip-padding px-cell-x first:rounded-l-full last:border-r-0 group-selected:bg-selected-frame">
        <Text nowrap truncate="1" className="block">
          {user.email}
        </Text>
      </Cell>
      {doDeleteUserRaw == null ?
        null
      : doDeleteUser == null ?
        <></>
      : <Cell className="relative bg-transparent p-0 opacity-0 group-hover-2:opacity-100">
          <DialogTrigger>
            <Button
              size="custom"
              variant="custom"
              className="absolute right-full mr-4 size-4 -translate-y-1/2"
            >
              <img src={Cross2} className="size-4" />
            </Button>
            <ConfirmDeleteModal
              actionText={getText('deleteUserActionText', user.name)}
              doDelete={() => {
                doDeleteUser(user)
              }}
            />
          </DialogTrigger>
        </Cell>
      }
    </Row>
  )
}
