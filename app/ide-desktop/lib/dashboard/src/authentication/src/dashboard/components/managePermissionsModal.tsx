/** @file A modal with inputs for user email and permission level. */
import * as React from 'react'
import * as toast from 'react-toastify'

import * as auth from '../../authentication/providers/auth'
import * as backendModule from '../backend'
import * as backendProvider from '../../providers/backend'
import * as hooks from '../../hooks'

import Autocomplete from './autocomplete'
import Modal from './modal'
import PermissionSelector from './permissionSelector'
import UserPermissions from './userPermissions'

// ==============================
// === ManagePermissionsModal ===
// ==============================

/** Props for a {@link ManagePermissionsModal}. */
export interface ManagePermissionsModalProps {
    item: backendModule.AnyAsset
    setItem: React.Dispatch<React.SetStateAction<backendModule.AnyAsset>>
    eventTarget: HTMLElement
}

/** A modal with inputs for user email and permission level.
 * @throws {Error} when the current backend is the local backend, or when the user is offline.
 * This should never happen, as this modal should not be accessible in either case. */
export default function ManagePermissionsModal(props: ManagePermissionsModalProps) {
    const { item, setItem, eventTarget } = props
    const { organization } = auth.useNonPartialUserSession()
    const { backend } = backendProvider.useBackend()
    const toastAndLog = hooks.useToastAndLog()
    const [permissions, setPermissions] = React.useState(item.permissions ?? [])
    const [users, setUsers] = React.useState<backendModule.SimpleUser[]>([])
    const [email, setEmail] = React.useState<string | null>(null)
    const [action, setAction] = React.useState(backendModule.PermissionAction.view)
    const emailValidityRef = React.useRef<HTMLInputElement>(null)
    const position = React.useMemo(() => eventTarget.getBoundingClientRect(), [eventTarget])
    const usernamesOfUsersWithPermission = React.useMemo(
        () => new Set(item.permissions?.map(userPermission => userPermission.user.user_name)),
        [item.permissions]
    )
    const emailsOfUsersWithPermission = React.useMemo(
        () =>
            new Set<string>(
                item.permissions?.map(userPermission => userPermission.user.user_email)
            ),
        [item.permissions]
    )

    React.useEffect(() => {
        setItem(oldItem => ({ ...oldItem, permissions }))
    }, [permissions, /* should never change */ setItem])

    if (backend.type === backendModule.BackendType.local || organization == null) {
        // This should never happen - the local backend does not have the "shared with" column,
        // and `organization` is absent only when offline - in which case the user should only
        // be able to access the local backend.
        // This MUST be an error, otherwise the hooks below are considered as conditionally called.
        throw new Error('Unable to share projects on the local backend.')
    } else {
        const listedUsers = hooks.useAsyncEffect([], () => backend.listUsers(), [])
        const allUsers = React.useMemo(
            () =>
                listedUsers.filter(
                    listedUser =>
                        !usernamesOfUsersWithPermission.has(listedUser.name) &&
                        !emailsOfUsersWithPermission.has(listedUser.email)
                ),
            [emailsOfUsersWithPermission, usernamesOfUsersWithPermission, listedUsers]
        )
        const willInviteNewUser = React.useMemo(() => {
            if (users.length !== 0) {
                return false
            } else if (email == null || email === '') {
                return true
            } else {
                const lowercase = email.toLowerCase()
                return (
                    lowercase !== '' &&
                    !usernamesOfUsersWithPermission.has(lowercase) &&
                    !emailsOfUsersWithPermission.has(lowercase) &&
                    !allUsers.some(
                        innerUser =>
                            innerUser.name.toLowerCase() === lowercase ||
                            innerUser.email.toLowerCase() === lowercase
                    )
                )
            }
        }, [
            users.length,
            email,
            emailsOfUsersWithPermission,
            usernamesOfUsersWithPermission,
            allUsers,
        ])

        const doSubmit = async () => {
            if (willInviteNewUser) {
                try {
                    setUsers([])
                    if (email != null) {
                        await backend.inviteUser({
                            organizationId: organization.id,
                            userEmail: backendModule.EmailAddress(email),
                        })
                        toast.toast.success(`You've invited ${email} to join Enso!`)
                    }
                } catch (error) {
                    toastAndLog('Could not invite user', error)
                }
            } else {
                setUsers([])
                const addedUsersPermissions = users.map<backendModule.UserPermission>(newUser => ({
                    user: {
                        // The names come from a third-party API and cannot be
                        // changed.
                        /* eslint-disable @typescript-eslint/naming-convention */
                        organization_id: organization.id,
                        pk: newUser.id,
                        user_email: newUser.email,
                        user_name: newUser.name,
                        /* eslint-enable @typescript-eslint/naming-convention */
                    },
                    permission: action,
                }))
                const addedUsersPks = new Set(addedUsersPermissions.map(newUser => newUser.user.pk))
                const oldUsersPermissions = permissions.filter(userPermission =>
                    addedUsersPks.has(userPermission.user.pk)
                )
                try {
                    setPermissions(oldPermissions =>
                        [
                            ...oldPermissions.filter(
                                oldUserPermissions => !addedUsersPks.has(oldUserPermissions.user.pk)
                            ),
                            ...addedUsersPermissions,
                        ].sort(backendModule.compareUserPermissions)
                    )
                    await backend.createPermission({
                        userSubjects: addedUsersPermissions.map(
                            userPermissions => userPermissions.user.pk
                        ),
                        resourceId: item.id,
                        action: action,
                    })
                } catch (error) {
                    setPermissions(oldPermissions =>
                        [
                            ...oldPermissions.filter(
                                permission => !addedUsersPks.has(permission.user.pk)
                            ),
                            ...oldUsersPermissions,
                        ].sort(backendModule.compareUserPermissions)
                    )
                    const usernames = addedUsersPermissions.map(
                        userPermissions => userPermissions.user.user_name
                    )
                    toastAndLog(`Unable to set permissions for ${usernames.join(', ')}`, error)
                }
            }
        }

        const doDelete = async (userToDelete: backendModule.User) => {
            const oldPermission = permissions.find(
                userPermission => userPermission.user.pk === userToDelete.pk
            )
            try {
                setPermissions(oldPermissions =>
                    oldPermissions.filter(
                        oldUserPermissions => oldUserPermissions.user.pk !== userToDelete.pk
                    )
                )
                await backend.createPermission({
                    userSubjects: [userToDelete.pk],
                    resourceId: item.id,
                    action: null,
                })
            } catch (error) {
                if (oldPermission != null) {
                    setPermissions(oldPermissions =>
                        [...oldPermissions, oldPermission].sort(
                            backendModule.compareUserPermissions
                        )
                    )
                }
                toastAndLog(`Unable to set permissions of '${userToDelete.user_email}'`, error)
            }
        }

        return (
            <Modal className="absolute overflow-hidden bg-dim w-full h-full top-0 left-0 z-10">
                <div
                    style={{
                        left: position.left + window.scrollX,
                        top: position.top + window.scrollY,
                    }}
                    className="sticky w-115.25"
                    onClick={mouseEvent => {
                        mouseEvent.stopPropagation()
                    }}
                    onContextMenu={mouseEvent => {
                        mouseEvent.stopPropagation()
                        mouseEvent.preventDefault()
                    }}
                >
                    <div className="absolute bg-frame-selected backdrop-blur-3xl rounded-2xl h-full w-full -z-10" />
                    <div className="flex flex-col rounded-2xl gap-2 p-2">
                        <div>
                            <h2 className="text-sm font-bold">Invite</h2>
                            {/* Space reserved for other tabs. */}
                        </div>
                        <form
                            className="flex gap-1"
                            onSubmit={event => {
                                event.preventDefault()
                                void doSubmit()
                            }}
                        >
                            <div className="flex items-center grow rounded-full border border-black-a10 gap-2 px-1">
                                <PermissionSelector
                                    disabled={willInviteNewUser}
                                    action={backendModule.PermissionAction.view}
                                    assetType={item.type}
                                    onChange={setAction}
                                />
                                <input
                                    readOnly
                                    hidden
                                    ref={emailValidityRef}
                                    type="email"
                                    className="hidden"
                                    value={email ?? ''}
                                />
                                <Autocomplete
                                    multiple
                                    autoFocus
                                    placeholder="Type usernames or emails to search or invite"
                                    type="text"
                                    itemsToString={items =>
                                        items.length === 1 && items[0] != null
                                            ? items[0].email
                                            : `${items.length} users selected`
                                    }
                                    values={users}
                                    setValues={setUsers}
                                    items={allUsers}
                                    itemToKey={user => user.id}
                                    itemToString={user => user.email}
                                    matches={(user, text) =>
                                        user.email.toLowerCase().includes(text.toLowerCase()) ||
                                        user.name.toLowerCase().includes(text.toLowerCase())
                                    }
                                    className="grow"
                                    inputClassName="bg-transparent leading-170 h-6 py-px"
                                    text={email}
                                    setText={setEmail}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={
                                    users.length === 0 ||
                                    (email != null && emailsOfUsersWithPermission.has(email)) ||
                                    (willInviteNewUser &&
                                        emailValidityRef.current?.validity.valid !== true)
                                }
                                className="text-tag-text bg-invite rounded-full px-2 py-1 disabled:opacity-30"
                            >
                                <div className="h-6 py-0.5">
                                    {willInviteNewUser ? 'Invite' : 'Share'}
                                </div>
                            </button>
                        </form>
                        <div className="overflow-auto pl-1 pr-12 max-h-80">
                            {permissions.map(userPermissions => (
                                <div
                                    key={userPermissions.user.pk}
                                    className="flex items-center h-8"
                                >
                                    <UserPermissions
                                        asset={item}
                                        userPermission={userPermissions}
                                        setUserPermission={newUserPermission => {
                                            setPermissions(oldPermissions =>
                                                oldPermissions
                                                    .map(oldUserPermission =>
                                                        oldUserPermission.user.pk ===
                                                        newUserPermission.user.pk
                                                            ? newUserPermission
                                                            : oldUserPermission
                                                    )
                                                    .sort(backendModule.compareUserPermissions)
                                            )
                                        }}
                                        doDelete={doDelete}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>
        )
    }
}
