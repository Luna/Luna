/** @file Permissions for a specific user or user group on a specific asset. */
import { useEffect, useState } from 'react'

import { useMutation } from '@tanstack/react-query'

import type Backend from 'enso-common/src/services/Backend'
import {
  AssetType,
  getAssetPermissionId,
  getAssetPermissionName,
  type Asset,
  type AssetPermission,
  type UserPermissionIdentifier,
} from 'enso-common/src/services/Backend'
import type { TextId } from 'enso-common/src/text'
import { merge } from 'enso-common/src/utilities/data/object'

import { Text } from '#/components/AriaComponents'
import PermissionSelector from '#/components/dashboard/PermissionSelector'
import FocusArea from '#/components/styled/FocusArea'
import { backendMutationOptions } from '#/hooks/backendHooks'
import { useToastAndLog } from '#/hooks/toastAndLogHooks'
import { useText } from '#/providers/TextProvider'

const ASSET_TYPE_TO_TEXT_ID: Readonly<Record<AssetType, TextId>> = {
  [AssetType.directory]: 'directoryAssetType',
  [AssetType.project]: 'projectAssetType',
  [AssetType.file]: 'fileAssetType',
  [AssetType.secret]: 'secretAssetType',
  [AssetType.specialEmpty]: 'specialEmptyAssetType',
  [AssetType.specialError]: 'specialErrorAssetType',
  [AssetType.specialLoading]: 'specialLoadingAssetType',
  [AssetType.datalink]: 'datalinkAssetType',
} satisfies { [Type in AssetType]: `${Type}AssetType` }

/** Props for a {@link Permission}. */
export interface PermissionProps {
  readonly backend: Backend
  readonly asset: Pick<Asset, 'id' | 'permissions' | 'type'>

  readonly self: AssetPermission
  readonly isOnlyOwner: boolean
  readonly permission: AssetPermission
  readonly setPermission: (userPermissions: AssetPermission) => void
  readonly doDelete: (user: UserPermissionIdentifier) => void
}

/** A user or group, and their permissions for a specific asset. */
export default function Permission(props: PermissionProps) {
  const { backend, asset, self, isOnlyOwner, doDelete } = props
  const { permission: initialPermission, setPermission: outerSetPermission } = props
  const { getText } = useText()
  const toastAndLog = useToastAndLog()
  const [permission, setPermission] = useState(initialPermission)
  const permissionId = getAssetPermissionId(permission)
  const isDisabled = isOnlyOwner && getAssetPermissionId(self) === permissionId
  const assetTypeName = getText(ASSET_TYPE_TO_TEXT_ID[asset.type])

  const createPermission = useMutation(
    backendMutationOptions(backend, 'createPermission'),
  ).mutateAsync

  useEffect(() => {
    setPermission(initialPermission)
  }, [initialPermission])

  const doSetPermission = async (newPermission: AssetPermission) => {
    try {
      setPermission(newPermission)
      outerSetPermission(newPermission)
      await createPermission([
        {
          actorsIds: [getAssetPermissionId(newPermission)],
          resourceId: asset.id,
          action: newPermission.permission,
        },
      ])
    } catch (error) {
      setPermission(permission)
      outerSetPermission(permission)
      toastAndLog('setPermissionsError', error)
    }
  }

  return (
    <FocusArea active={!isDisabled} direction="horizontal">
      {(innerProps) => (
        <div className="flex w-full items-center gap-user-permission" {...innerProps}>
          <PermissionSelector
            showDelete
            isDisabled={isDisabled}
            error={isOnlyOwner ? getText('needsOwnerError', assetTypeName) : null}
            selfPermission={self.permission}
            action={permission.permission}
            assetType={asset.type}
            onChange={async (permissions) => {
              await doSetPermission(merge(permission, { permission: permissions }))
            }}
            doDelete={() => {
              doDelete(getAssetPermissionId(permission))
            }}
          />
          <Text truncate="1">{getAssetPermissionName(permission)}</Text>
        </div>
      )}
    </FocusArea>
  )
}
