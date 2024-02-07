/** @file A user and their permissions for a specific asset. */
import * as React from 'react'

import * as toastAndLogHooks from '#/hooks/toastAndLogHooks'

import * as backendProvider from '#/providers/BackendProvider'
import * as textProvider from '#/providers/TextProvider'

import PermissionSelector from '#/components/dashboard/PermissionSelector'

import type * as backendModule from '#/services/Backend'

import * as object from '#/utilities/object'

/** Props for a {@link UserPermissions}. */
export interface UserPermissionsProps {
  readonly asset: backendModule.Asset
  readonly self: backendModule.UserPermission
  readonly isOnlyOwner: boolean
  readonly userPermission: backendModule.UserPermission
  readonly setUserPermission: (userPermissions: backendModule.UserPermission) => void
  readonly doDelete: (user: backendModule.User) => void
}

/** A user and their permissions for a specific asset. */
export default function UserPermissions(props: UserPermissionsProps) {
  const { asset, self, isOnlyOwner, doDelete } = props
  const { userPermission: initialUserPermission, setUserPermission: outerSetUserPermission } = props
  const { backend } = backendProvider.useBackend()
  const { getText } = textProvider.useText()
  const toastAndLog = toastAndLogHooks.useToastAndLog()
  const [userPermissions, setUserPermissions] = React.useState(initialUserPermission)
  const assetTypeName = getText(`${asset.type}AssetType`)

  React.useEffect(() => {
    setUserPermissions(initialUserPermission)
  }, [initialUserPermission])

  const doSetUserPermission = async (newUserPermissions: backendModule.UserPermission) => {
    try {
      setUserPermissions(newUserPermissions)
      outerSetUserPermission(newUserPermissions)
      await backend.createPermission({
        userSubjects: [newUserPermissions.user.pk],
        resourceId: asset.id,
        action: newUserPermissions.permission,
      })
    } catch (error) {
      setUserPermissions(userPermissions)
      outerSetUserPermission(userPermissions)
      toastAndLog('setPermissionsError', error, newUserPermissions.user.user_email)
    }
  }

  return (
    <div className="flex gap-3 items-center">
      <PermissionSelector
        showDelete
        disabled={isOnlyOwner && userPermissions.user.pk === self.user.pk}
        error={isOnlyOwner ? getText('needsOwnerError', assetTypeName) : null}
        selfPermission={self.permission}
        action={userPermissions.permission}
        assetType={asset.type}
        onChange={async permissions => {
          await doSetUserPermission(object.merge(userPermissions, { permission: permissions }))
        }}
        doDelete={() => {
          doDelete(userPermissions.user)
        }}
      />
      <span className="leading-170 h-6 py-px">{userPermissions.user.user_name}</span>
    </div>
  )
}
