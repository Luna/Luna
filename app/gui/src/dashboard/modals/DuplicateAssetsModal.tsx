/** @file A modal opened when uploaded assets. */
import { useEffect, useState } from 'react'

import { useMutation } from '@tanstack/react-query'

import {
  AssetType,
  extractProjectExtension,
  stripProjectExtension,
  type AnyAsset,
  type DirectoryId,
  type FileAsset,
  type ProjectAsset,
} from '@common/services/Backend'
import { basenameAndExtension } from '@common/utilities/data/fileInfo'
import { unsafeMutable } from '@common/utilities/data/object'

import { Heading, Text } from '#/components/aria'
import { Button, ButtonGroup } from '#/components/AriaComponents'
import AssetSummary from '#/components/dashboard/AssetSummary'
import Modal from '#/components/Modal'
import { useSetModal } from '#/providers/ModalProvider'
import { useText } from '#/providers/TextProvider'

/**
 * An object containing the current asset, and the asset that is about to be uploaded,
 * that will conflict with the existing asset.
 */
export interface ConflictingAsset<
  Asset extends FileAsset | ProjectAsset = FileAsset | ProjectAsset,
> {
  readonly current: AnyAsset
  readonly new: Asset
  readonly file: File
}

/** Props for a {@link DuplicateAssetsModal}. */
export interface DuplicateAssetsModalProps {
  readonly parentKey: DirectoryId
  readonly parentId: DirectoryId
  readonly conflictingFiles: readonly ConflictingAsset<FileAsset>[]
  readonly conflictingProjects: readonly ConflictingAsset<ProjectAsset>[]
  readonly siblingFileNames: Iterable<string>
  readonly siblingProjectNames: Iterable<string>
  readonly nonConflictingFileCount: number
  readonly nonConflictingProjectCount: number
  readonly doUploadNonConflicting: () => Promise<void> | void
  readonly doUpdateConflicting: (toUpdate: ConflictingAsset[]) => Promise<void> | void
}

/** A modal for creating a new label. */
export default function DuplicateAssetsModal(props: DuplicateAssetsModalProps) {
  const { conflictingFiles: conflictingFilesRaw } = props
  const { conflictingProjects: conflictingProjectsRaw, doUpdateConflicting } = props
  const { siblingFileNames: siblingFileNamesRaw } = props
  const { siblingProjectNames: siblingProjectNamesRaw } = props
  const { nonConflictingFileCount, nonConflictingProjectCount, doUploadNonConflicting } = props
  const { unsetModal } = useSetModal()
  const { getText } = useText()
  const [conflictingFiles, setConflictingFiles] = useState(conflictingFilesRaw)
  const [conflictingProjects, setConflictingProjects] = useState(conflictingProjectsRaw)
  const [didUploadNonConflicting, setDidUploadNonConflicting] = useState(false)
  const [siblingFileNames] = useState(new Set<string>())
  const [siblingProjectNames] = useState(new Set<string>())
  const count = conflictingFiles.length + conflictingProjects.length
  const firstConflict = conflictingFiles[0] ?? conflictingProjects[0]
  const otherFilesCount = Math.max(0, conflictingFiles.length - 1)
  const otherProjectsCount = conflictingProjects.length - (conflictingFiles.length > 0 ? 0 : 1)
  const updateConflictingMutation = useMutation({
    mutationKey: ['updateConflicting'],
    mutationFn: async (...args: Parameters<typeof doUpdateConflicting>) => {
      await doUpdateConflicting(...args)
    },
  })
  const uploadNonConflictingMutation = useMutation({
    mutationKey: ['uploadNonConflicting'],
    mutationFn: async (...args: Parameters<typeof doUploadNonConflicting>) => {
      await doUploadNonConflicting(...args)
    },
  })
  const isLoading = uploadNonConflictingMutation.isPending || updateConflictingMutation.isPending

  useEffect(() => {
    for (const name of siblingFileNamesRaw) {
      siblingFileNames.add(name)
    }
    for (const name of siblingProjectNamesRaw) {
      siblingProjectNames.add(name)
    }
    // Note that because the props are `Iterable`s, they may be different each time
    // even if their contents are identical. However, as this component should never
    // be re-rendered with different props, the dependency list should not matter anyway.
  }, [siblingFileNames, siblingFileNamesRaw, siblingProjectNames, siblingProjectNamesRaw])

  const findNewName = (conflict: ConflictingAsset, commit = true) => {
    let title = conflict.file.name
    switch (conflict.new.type) {
      case AssetType.file: {
        const { basename, extension } = basenameAndExtension(title)
        let i = 1
        while (true) {
          i += 1
          const candidateTitle = `${basename} ${i}.${extension}`
          if (!siblingFileNames.has(candidateTitle)) {
            if (commit) {
              siblingFileNames.add(candidateTitle)
            }
            title = candidateTitle
            break
          }
        }
        break
      }
      case AssetType.project: {
        const { basename, extension } = extractProjectExtension(title)
        title = basename
        let i = 1
        while (true) {
          i += 1
          const candidateTitle = `${title} ${i}`
          if (!siblingProjectNames.has(candidateTitle)) {
            if (commit) {
              siblingProjectNames.add(candidateTitle)
            }
            title = `${candidateTitle}.${extension}`
            break
          }
        }
        break
      }
    }
    return title
  }

  const doRename = (toRename: ConflictingAsset[]) => {
    const clonedConflicts = structuredClone(toRename)

    for (const conflict of clonedConflicts) {
      // This is SAFE, as it is a shallow mutation of a freshly cloned object.
      unsafeMutable(conflict.new).title = findNewName(conflict)
    }

    return clonedConflicts
  }

  return (
    <Modal centered className="absolute bg-dim">
      <form
        data-testid="new-label-modal"
        tabIndex={-1}
        className="pointer-events-auto relative flex w-duplicate-assets-modal flex-col gap-modal rounded-default p-modal-wide pt-modal before:absolute before:inset before:h-full before:w-full before:rounded-default before:bg-selected-frame before:backdrop-blur-default"
        onClick={(event) => {
          event.stopPropagation()
        }}
        onSubmit={(event) => {
          event.preventDefault()
        }}
      >
        <Heading level={2} className="relative text-sm font-semibold">
          {conflictingFiles.length > 0 ?
            conflictingProjects.length > 0 ?
              getText('duplicateFilesAndProjectsFound')
            : getText('duplicateFilesFound')
          : getText('duplicateProjectsFound')}
        </Heading>
        {nonConflictingFileCount > 0 ||
          (nonConflictingProjectCount > 0 && (
            <div className="relative flex flex-col">
              {nonConflictingFileCount > 0 && (
                <Text className="text">
                  {nonConflictingFileCount === 1 ?
                    getText('fileWithoutConflicts')
                  : getText('filesWithoutConflicts', nonConflictingFileCount)}
                </Text>
              )}
              {nonConflictingProjectCount > 0 && (
                <Text className="text">
                  {nonConflictingProjectCount === 1 ?
                    getText('projectWithoutConflicts')
                  : getText('projectsWithoutConflicts', nonConflictingFileCount)}
                </Text>
              )}
              <Button
                variant="outline"
                isDisabled={didUploadNonConflicting}
                onPress={async () => {
                  await doUploadNonConflicting()
                  setDidUploadNonConflicting(true)
                }}
              >
                {didUploadNonConflicting ? getText('uploaded') : getText('upload')}
              </Button>
            </div>
          ))}
        {firstConflict && (
          <>
            <div className="flex flex-col">
              <Text className="relative">{getText('currentColon')}</Text>
              <AssetSummary asset={firstConflict.current} className="relative" />
            </div>
            <div className="flex flex-col">
              <Text className="relative">{getText('newColon')}</Text>
              <AssetSummary
                new
                newName={stripProjectExtension(findNewName(firstConflict, false))}
                asset={firstConflict.new}
                className="relative"
              />
            </div>
            {count > 1 && (
              <ButtonGroup>
                <Button
                  variant="outline"
                  onPress={async () => {
                    switch (firstConflict.new.type) {
                      case AssetType.file: {
                        setConflictingFiles((oldConflicts) => oldConflicts.slice(1))
                        break
                      }
                      case AssetType.project: {
                        setConflictingProjects((oldConflicts) => oldConflicts.slice(1))
                        break
                      }
                    }
                    await doUpdateConflicting([firstConflict])
                  }}
                >
                  {getText('update')}
                </Button>

                <Button
                  variant="outline"
                  onPress={() => {
                    doRename([firstConflict])
                    switch (firstConflict.new.type) {
                      case AssetType.file: {
                        setConflictingFiles((oldConflicts) => oldConflicts.slice(1))
                        break
                      }
                      case AssetType.project: {
                        setConflictingProjects((oldConflicts) => oldConflicts.slice(1))
                        break
                      }
                    }
                  }}
                >
                  {firstConflict.new.type === AssetType.file ?
                    getText('renameNewFile')
                  : getText('renameNewProject')}
                </Button>
              </ButtonGroup>
            )}
          </>
        )}
        {otherFilesCount > 0 && (
          <Text className="relative">
            {otherFilesCount === 1 ?
              getText('andOtherFile')
            : getText('andOtherFiles', otherFilesCount)}
          </Text>
        )}
        {otherProjectsCount > 0 && (
          <Text className="relative">
            {otherProjectsCount === 1 ?
              getText('andOtherProject')
            : getText('andOtherProjects', otherProjectsCount)}
          </Text>
        )}

        <ButtonGroup className="relative">
          <Button
            variant="submit"
            loading={isLoading}
            onPress={async () => {
              await Promise.allSettled([
                uploadNonConflictingMutation.mutateAsync(),
                updateConflictingMutation.mutateAsync([
                  ...conflictingFiles,
                  ...conflictingProjects,
                ]),
              ])
              unsetModal()
            }}
          >
            {count === 1 ? getText('update') : getText('updateAll')}
          </Button>

          <Button
            variant="accent"
            loading={isLoading}
            onPress={async () => {
              const resolved = doRename([...conflictingFiles, ...conflictingProjects])
              await Promise.allSettled([
                uploadNonConflictingMutation.mutateAsync(),
                updateConflictingMutation.mutateAsync(resolved),
              ])
              unsetModal()
            }}
          >
            {count === 1 ?
              firstConflict?.new.type === AssetType.file ?
                getText('renameNewFile')
              : getText('renameNewProject')
            : firstConflict?.new.type === AssetType.file ?
              getText('renameNewFiles')
            : getText('renameNewProjects')}
          </Button>
          <Button variant="outline" loading={isLoading} onPress={unsetModal}>
            {getText('cancel')}
          </Button>
        </ButtonGroup>
      </form>
    </Modal>
  )
}
