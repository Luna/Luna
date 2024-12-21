/** @file A row of the user groups table representing a user. */
import type { User, UserGroupInfo } from '@common/services/Backend'

import Cross2 from '#/assets/cross2.svg'
import { Cell, Row } from '#/components/aria'
import { Button, DialogTrigger, Text } from '#/components/AriaComponents'
import ContextMenuEntry from '#/components/ContextMenuEntry'
import { useContextMenuRef } from '#/hooks/contextMenuHooks'
import ConfirmDeleteModal from '#/modals/ConfirmDeleteModal'
import { useFullUserSession } from '#/providers/AuthProvider'
import { useSetModal } from '#/providers/ModalProvider'
import { useText } from '#/providers/TextProvider'

/** Props for a {@link UserGroupUserRow}. */
export interface UserGroupUserRowProps {
  readonly user: User
  readonly userGroup: UserGroupInfo
  readonly doRemoveUserFromUserGroup: (user: User, userGroup: UserGroupInfo) => void
}

/** A row of the user groups table representing a user. */
export default function UserGroupUserRow(props: UserGroupUserRowProps) {
  const { user, userGroup, doRemoveUserFromUserGroup } = props
  const { user: currentUser } = useFullUserSession()
  const { setModal } = useSetModal()
  const { getText } = useText()
  const isAdmin = currentUser.isOrganizationAdmin
  const contextMenuRef = useContextMenuRef(
    getText('userGroupUserContextMenuLabel'),
    () => (
      <ContextMenuEntry
        action="delete"
        doAction={() => {
          setModal(
            <ConfirmDeleteModal
              defaultOpen
              actionText={getText(
                'removeUserFromUserGroupActionText',
                user.name,
                userGroup.groupName,
              )}
              doDelete={() => {
                doRemoveUserFromUserGroup(user, userGroup)
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
      id={`_key-${userGroup.id}-${user.userId}`}
      className="group h-row select-none rounded-rows-child"
      ref={contextMenuRef}
    >
      <Cell className="border-x-2 border-transparent bg-clip-padding py-0 rounded-rows-skip-level last:border-r-0">
        <div className="ml-6 flex h-row items-center justify-center rounded-full px-cell-x">
          <Text nowrap truncate="1" weight="semibold">
            {user.name}
          </Text>
        </div>
      </Cell>
      <Cell className="relative bg-transparent p-0 opacity-0 rounded-rows-have-level group-hover-2:opacity-100">
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
              actionText={getText(
                'removeUserFromUserGroupActionText',
                user.name,
                userGroup.groupName,
              )}
              actionButtonLabel={getText('remove')}
              doDelete={() => {
                doRemoveUserFromUserGroup(user, userGroup)
              }}
            />
          </DialogTrigger>
        )}
      </Cell>
    </Row>
  )
}
