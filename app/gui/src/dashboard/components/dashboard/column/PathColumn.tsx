/** @file A column displaying the path of the asset. */
import FolderArrowIcon from '#/assets/folder_arrow.svg'
import { Button, Popover } from '#/components/AriaComponents'
import SvgMask from '#/components/SvgMask'
import { backendQueryOptions } from '#/hooks/backendHooks'
import { useUser } from '#/providers/AuthProvider'
import { DirectoryId } from '#/services/Backend'
import { useSuspenseQuery } from '@tanstack/react-query'
import type { AssetColumnProps } from '../column'

/** A column displaying the path of the asset. */
export default function PathColumn(props: AssetColumnProps) {
  const { item, state } = props

  const { virtualParentsPath, parentsPath } = item

  const splittedPath = parentsPath.split('/').map((id) => DirectoryId(id))
  const rootDirectoryInPath = splittedPath[0]

  const { data: allUserGroups } = useSuspenseQuery(
    backendQueryOptions(state.backend, 'listUserGroups', []),
  )
  const { rootDirectoryId, userGroups } = useUser()

  const userGroupsById = new Map(
    userGroups?.map((id) => [id, allUserGroups.find((group) => group.id === id)]),
  )

  console.log({ userGroupsById })

  const finalPath = (() => {
    const result = []

    if (rootDirectoryInPath != null) {
      if (rootDirectoryInPath === rootDirectoryId) {
        result.push('My Files')
      }

      if (userGroupsById.has(rootDirectoryInPath)) {
        result.push(userGroupsById.get(rootDirectoryInPath)?.groupName)
      }
    }

    if (virtualParentsPath.length > 0) {
      result.push(...virtualParentsPath.split('/'))
    }

    return result
  })()

  console.log({ virtualParentsPath, parentsPath, splittedPath, rootDirectoryId, finalPath })

  if (finalPath.length === 0) {
    return <></>
  }

  if (finalPath.length === 1) {
    return (
      <Button variant="ghost" size="xsmall">
        {finalPath.at(-1)}
      </Button>
    )
  }

  return (
    <Popover.Trigger>
      <Button variant="ghost" size="xsmall">
        {finalPath.at(-1)}
      </Button>

      <Popover size="auto" placement="bottom end" crossOffset={12}>
        <div className="flex items-center gap-1">
          {finalPath.map((path, index) => (
            <>
              <Button key={path} variant="icon">
                {path}
              </Button>

              {index < finalPath.length - 1 && (
                <SvgMask src={FolderArrowIcon} className="h-4 w-4 text-primary" />
              )}
            </>
          ))}
        </div>
      </Popover>
    </Popover.Trigger>
  )
}
