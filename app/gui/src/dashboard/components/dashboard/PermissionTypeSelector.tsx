/** @file A selector for all possible permission types. */
import type { CSSProperties } from 'react'

import { AssetType } from 'enso-common/src/services/Backend'

import { Label, Text } from '#/components/aria'
import { Button } from '#/components/AriaComponents'
import FocusArea from '#/components/styled/FocusArea'
import { Permission, PERMISSION_CLASS_NAME, PermissionAction } from '#/utilities/permissions'
import { twMerge } from '#/utilities/tailwindMerge'

const CAPITALIZED_ASSET_TYPE: Readonly<Record<AssetType, string>> = {
  [AssetType.directory]: 'Folder',
  [AssetType.project]: 'Project',
  [AssetType.file]: 'File',
  [AssetType.datalink]: 'Datalink',
  [AssetType.secret]: 'Secret',
  // These assets should never be visible, since they don't appear in the UI at all.
  [AssetType.specialEmpty]: '',
  [AssetType.specialError]: '',
  [AssetType.specialLoading]: '',
}

/** Data needed to display a single permission type. */
interface PermissionTypeData {
  readonly type: Permission
  readonly previous: Permission | null
  readonly description: (type: AssetType) => string
}

/** Data needed to display each permission type. */
const PERMISSION_TYPE_DATA: readonly PermissionTypeData[] = [
  {
    type: Permission.view,
    previous: null,
    description: (type) =>
      CAPITALIZED_ASSET_TYPE[type] +
      ` visibility only. Optionally, edit docs${
        type === AssetType.project ? ' and execute project' : ''
      }.`,
  },
  {
    type: Permission.read,
    previous: Permission.view,
    description: (type) => CAPITALIZED_ASSET_TYPE[type] + ' content reading.',
  },
  {
    type: Permission.edit,
    previous: Permission.read,
    description: (type) => CAPITALIZED_ASSET_TYPE[type] + ' editing.',
  },
  {
    type: Permission.admin,
    previous: Permission.edit,
    description: () => 'Sharing management.',
  },
  {
    type: Permission.owner,
    previous: Permission.admin,
    description: (type) => CAPITALIZED_ASSET_TYPE[type] + ' removal permission.',
  },
  {
    type: Permission.delete,
    previous: null,
    description: () => 'Remove all permissions from this user.',
  },
]

/** Props for a {@link PermissionTypeSelector}. */
export interface PermissionTypeSelectorProps {
  readonly showDelete?: boolean
  readonly selfPermission: PermissionAction
  readonly type: Permission
  readonly assetType: AssetType
  readonly style?: CSSProperties
  readonly onChange: (permission: Permission) => void
}

/** A selector for all possible permission types. */
export default function PermissionTypeSelector(props: PermissionTypeSelectorProps) {
  const { showDelete = false, selfPermission, type, assetType, style, onChange } = props
  return (
    <FocusArea direction="vertical">
      {(innerProps) => (
        <div
          style={style}
          className="pointer-events-auto sticky w-min rounded-permission-type-selector before:absolute before:h-full before:w-full before:rounded-permission-type-selector before:bg-selected-frame before:backdrop-blur-default"
          onClick={(event) => {
            event.stopPropagation()
          }}
          {...innerProps}
        >
          <div className="group relative flex w-permission-type-selector flex-col p-permission-type-selector">
            {PERMISSION_TYPE_DATA.filter(
              (data) =>
                (showDelete ? true : data.type !== Permission.delete) &&
                (selfPermission === PermissionAction.own ? true : data.type !== Permission.owner),
            ).map((data) => (
              <Button
                size="custom"
                variant="custom"
                key={data.type}
                className={twMerge(
                  'flex h-row items-start justify-stretch gap-permission-type-button rounded-full p-permission-type-button hover:bg-black/5',
                  type === data.type && 'bg-black/5 hover:!bg-black/5 group-hover:bg-transparent',
                )}
                onPress={() => {
                  onChange(data.type)
                }}
              >
                <div
                  className={twMerge(
                    'h-text w-permission-type rounded-full py-permission-type-y',
                    PERMISSION_CLASS_NAME[data.type],
                  )}
                >
                  {data.type}
                </div>
                {/* This is a symbol that should never need to be localized, since it is effectively
                 * an icon. */}
                {/* eslint-disable-next-line no-restricted-syntax */}
                <Text className="text font-normal">=</Text>
                {data.previous != null && (
                  <>
                    <div
                      className={twMerge(
                        'h-text w-permission-type rounded-full py-permission-type-y text-center',
                        PERMISSION_CLASS_NAME[data.previous],
                      )}
                    >
                      {data.previous}
                    </div>
                    {/* This is a symbol that should never need to be localized, since it is effectively
                     * an icon. */}
                    {/* eslint-disable-next-line no-restricted-syntax */}
                    <Text className="text font-normal">+</Text>
                  </>
                )}
                <Label className="text">{data.description(assetType)}</Label>
              </Button>
            ))}
          </div>
        </div>
      )}
    </FocusArea>
  )
}
