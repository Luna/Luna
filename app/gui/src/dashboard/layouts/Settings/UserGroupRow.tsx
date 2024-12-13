/** @file A row representing a user group. */
import type { UserGroupInfo } from 'enso-common/src/services/Backend'

import Cross2 from '#/assets/cross2.svg'
import { Cell, Row } from '#/components/aria'
import { Button, DialogTrigger, Text } from '#/components/AriaComponents'
import ContextMenuEntry from '#/components/ContextMenuEntry'
import { useContextMenuRef } from '#/hooks/contextMenuHooks'
import ConfirmDeleteModal from '#/modals/ConfirmDeleteModal'
import { useFullUserSession } from '#/providers/AuthProvider'
import { useSetModal } from '#/providers/ModalProvider'
import { useText } from '#/providers/TextProvider'

/** Props for a {@link UserGroupRow}. */
export interface UserGroupRowProps {
  readonly userGroup: UserGroupInfo
  readonly doDeleteUserGroup: (userGroup: UserGroupInfo) => void
}

/** A row representing a user group. */
export default function UserGroupRow(props: UserGroupRowProps) {
  const { userGroup, doDeleteUserGroup } = props
  const { user } = useFullUserSession()
  const { setModal } = useSetModal()
  const { getText } = useText()
  const isAdmin = user.isOrganizationAdmin
  const contextMenuRef = useContextMenuRef(
    getText('userGroupContextMenuLabel'),
    () => (
      <ContextMenuEntry
        action="delete"
        doAction={() => {
          setModal(
            <ConfirmDeleteModal
              defaultOpen
              actionText={getText('deleteUserGroupActionText', userGroup.groupName)}
              doDelete={() => {
                doDeleteUserGroup(userGroup)
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
      id={userGroup.id}
      className="group h-row select-none rounded-rows-child"
      ref={contextMenuRef}
    >
      <Cell className="rounded-r-full border-x-2 border-transparent bg-clip-padding px-cell-x first:rounded-l-full last:border-r-0">
        <div className="flex justify-center">
          <Text nowrap truncate="1" weight="semibold">
            {userGroup.groupName}
          </Text>
        </div>
      </Cell>
      <Cell className="relative bg-transparent p-0 opacity-0 group-hover-2:opacity-100">
        {isAdmin && (
          <DialogTrigger>
            <Button
              size="custom"
              variant="custom"
              className="absolute right-full mr-4 size-4 -translate-y-1/2"
            >
              <img src={Cross2} className="size-4" />
            </Button>
            <ConfirmDeleteModal
              actionText={getText('deleteUserGroupActionText', userGroup.groupName)}
              doDelete={() => {
                doDeleteUserGroup(userGroup)
              }}
            />
          </DialogTrigger>
        )}
      </Cell>
    </Row>
  )
}
