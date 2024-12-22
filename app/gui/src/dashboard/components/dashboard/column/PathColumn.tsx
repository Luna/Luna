/** @file A column displaying the path of the asset. */
import FolderIcon from '#/assets/folder.svg'
import FolderArrowIcon from '#/assets/folder_arrow.svg'
import { Button, Popover } from '#/components/AriaComponents'
import SvgMask from '#/components/SvgMask'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { useCloudCategoryList } from '#/layouts/Drive/Categories/categoriesHooks'
import type { AnyCloudCategory } from '#/layouts/Drive/Categories/Category'
import { useUser } from '#/providers/AuthProvider'
import {
  useSetCategoryId,
  useSetExpandedDirectoryIds,
  useSetSelectedKeys,
} from '#/providers/DriveProvider'
import type { DirectoryId } from '#/services/Backend'
import { isDirectoryId } from '#/services/Backend'
import { useTransition } from 'react'
import invariant from 'tiny-invariant'
import type { AssetColumnProps } from '../column'

/** A column displaying the path of the asset. */
export default function PathColumn(props: AssetColumnProps) {
  const { item, state } = props

  const { virtualParentsPath, parentsPath } = item

  const { getAssetNodeById } = state

  const setCategory = useSetCategoryId()
  const setSelectedKeys = useSetSelectedKeys()
  const setExpandedDirectoryIds = useSetExpandedDirectoryIds()

  // Path navigation exist only for cloud categories.
  const { getCategoryByDirectoryId } = useCloudCategoryList()

  // Parents path is a string of directory ids separated by slashes.
  const splittedPath = parentsPath.split('/').filter(isDirectoryId)
  const splittedVirtualParentsPath = virtualParentsPath.split('/')
  const rootDirectoryInPath = splittedPath[0]
  // Virtual parents path is a string of directory names separated by slashes.
  // To match the ids with the names, we need to remove the first element of the splitted path.
  // As the first element is the root directory, which is not a virtual parent.
  const virtualParentsIds = splittedPath.slice(1)

  const { rootDirectoryId } = useUser()

  const navigateToDirectory = useEventCallback((targetDirectory: DirectoryId) => {
    const targetDirectoryIndex = finalPath.findIndex(({ id }) => id === targetDirectory)

    if (targetDirectoryIndex === -1) {
      return
    }

    const pathToDirectory = finalPath
      .slice(0, targetDirectoryIndex + 1)
      .map(({ id, categoryId }) => ({ id, categoryId }))

    const rootDirectoryInThePath = pathToDirectory.at(0)

    // This should never happen, as we always have the root directory in the path.
    // If it happens, it means you've skrewed up
    invariant(rootDirectoryInThePath != null, 'Root directory id is null')

    // If the target directory is null, we assume that this directory is outside of the current tree (in another category)
    // Which is the default, because path displays in the recent and trash folders.
    // But sometimes user might delete a directory with it's whole content, and in that case we'll find it in the tree
    // because parent is always fetched before children.
    const targetDirectoryNode = getAssetNodeById(targetDirectory)

    if (targetDirectoryNode == null && rootDirectoryInThePath.categoryId != null) {
      // We need to set the category first, because setting a category
      // resets the list of expanded folders and selected keys
      setCategory(rootDirectoryInThePath.categoryId)
      setExpandedDirectoryIds(pathToDirectory.map(({ id }) => id).concat(targetDirectory))
    }

    setSelectedKeys(new Set([targetDirectory]))
  })

  const finalPath = (() => {
    const result: {
      id: DirectoryId
      categoryId: AnyCloudCategory['id'] | null
      label: AnyCloudCategory['label']
      icon: AnyCloudCategory['icon']
    }[] = []

    if (rootDirectoryInPath == null) {
      return result
    }

    const rootCategory = getCategoryByDirectoryId(rootDirectoryInPath)

    // If the root category is not found it might mean
    // that user is no longer have access to this root
    // Usually this could happen if user was removed from the organization
    // or user group.
    // This shouldn't happen though and these files should be filtered out
    // by the backend. But we need to handle this case anyway.
    if (rootCategory == null) {
      return result
    }

    result.push({
      id: rootDirectoryId,
      categoryId: rootCategory.id,
      label: rootCategory.label,
      icon: rootCategory.icon,
    })

    for (const [index, id] of virtualParentsIds.entries()) {
      const name = splittedVirtualParentsPath.at(index)

      if (name == null) {
        continue
      }

      result.push({
        id,
        label: name,
        icon: FolderIcon,
        categoryId: null,
      })
    }

    return result
  })()

  if (finalPath.length === 0) {
    return <></>
  }

  const lastPath = finalPath.at(-1)

  // Should not happen, as we ensure that the final path is not empty.
  if (lastPath == null) {
    return <></>
  }

  if (finalPath.length === 1) {
    return (
      <PathItem
        id={lastPath.id}
        label={lastPath.label}
        icon={lastPath.icon}
        onNavigate={navigateToDirectory}
      />
    )
  }

  return (
    <Popover.Trigger>
      <Button variant="ghost-fading" size="xsmall" icon={lastPath.icon}>
        {lastPath.label}
      </Button>

      <Popover
        size="auto"
        placement="bottom end"
        crossOffset={14}
        variant="primary"
        className="max-w-sm"
      >
        <div className="flex items-center gap-1">
          {finalPath.map((entry, index) => (
            <>
              <PathItem
                key={entry.id}
                id={entry.id}
                label={entry.label}
                icon={entry.icon}
                onNavigate={navigateToDirectory}
              />

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

/**
 * Individual item in the path.
 */
interface PathItemProps {
  readonly id: DirectoryId
  readonly label: AnyCloudCategory['label']
  readonly icon: AnyCloudCategory['icon']
  readonly onNavigate: (targetDirectory: DirectoryId) => void
}

/**
 * Individual item in the path.
 */
function PathItem(props: PathItemProps) {
  const { id, label, icon, onNavigate } = props
  const [transition, startTransition] = useTransition()

  const onPress = useEventCallback(() => {
    startTransition(() => {
      onNavigate(id)
    })
  })

  return (
    <Button
      key={id}
      variant="ghost-fading"
      size="xsmall"
      loading={transition}
      icon={icon}
      onPress={onPress}
      loaderPosition="icon"
    >
      {label}
    </Button>
  )
}
