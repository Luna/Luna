/**
 * @file Header menubar for the directory listing, containing information about
 * the current directory and some configuration options.
 */
import * as React from 'react'

import { useMutation } from '@tanstack/react-query'

import AddDatalinkIcon from '#/assets/add_datalink.svg'
import AddFolderIcon from '#/assets/add_folder.svg'
import AddKeyIcon from '#/assets/add_key.svg'
import DataDownloadIcon from '#/assets/data_download.svg'
import DataUploadIcon from '#/assets/data_upload.svg'
import ExpandArrowDownIcon from '#/assets/expand_arrow_down.svg'
import ExpandArrowRightIcon from '#/assets/expand_arrow_right.svg'
import Plus2Icon from '#/assets/plus2.svg'
import {
  Button,
  ButtonGroup,
  DialogTrigger,
  Form,
  Input,
  Popover,
  Text,
  useVisualTooltip,
  VisuallyHidden,
} from '#/components/AriaComponents'
import AssetEventType from '#/events/AssetEventType'
import {
  useNewDatalink,
  useNewFolder,
  useNewProject,
  useNewSecret,
  useRootDirectoryId,
  useUploadFiles,
} from '#/hooks/backendHooks'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { useOffline } from '#/hooks/offlineHooks'
import AssetSearchBar from '#/layouts/AssetSearchBar'
import {
  canTransferBetweenCategories,
  isCloudCategory,
  type Category,
} from '#/layouts/CategorySwitcher/Category'
import { useDispatchAssetEvent } from '#/layouts/Drive/EventListProvider'
import StartModal from '#/layouts/StartModal'
import ConfirmDeleteModal from '#/modals/ConfirmDeleteModal'
import UpsertDatalinkModal from '#/modals/UpsertDatalinkModal'
import UpsertSecretModal from '#/modals/UpsertSecretModal'
import {
  useCanCreateAssets,
  useCanDownload,
  useDriveStore,
  usePasteData,
} from '#/providers/DriveProvider'
import { useInputBindings } from '#/providers/InputBindingsProvider'
import { useSetModal } from '#/providers/ModalProvider'
import { useText } from '#/providers/TextProvider'
import type Backend from '#/services/Backend'
import type AssetQuery from '#/utilities/AssetQuery'
import { inputFiles } from '#/utilities/input'
import LocalStorage from '#/utilities/LocalStorage'
import * as sanitizedEventTargets from '#/utilities/sanitizedEventTargets'
import { z } from 'zod'
import { TemplatesCarousel } from '../pages/dashboard/components/TemplatesCarousel'
import { useFullUserSession } from '../providers/AuthProvider'
import { WithFeatureFlag } from '../providers/FeatureFlagsProvider'
import { useLocalStorageToggle } from '../providers/LocalStorageProvider'
import { AssetPanelToggle } from './AssetPanel'

declare module '#/utilities/LocalStorage' {
  /** */
  interface LocalStorageData {
    readonly displayExamples: boolean
  }
}

LocalStorage.registerKey('displayExamples', {
  schema: z.boolean(),
})

/** Props for a {@link DriveBar}. */
export interface DriveBarProps {
  readonly backend: Backend
  readonly query: AssetQuery
  readonly setQuery: React.Dispatch<React.SetStateAction<AssetQuery>>
  readonly category: Category
  readonly doEmptyTrash: () => void
  readonly isEmpty: boolean
  readonly shouldDisplayStartModal: boolean
  readonly isDisabled: boolean
}

/**
 * Displays the current directory path and permissions, upload and download buttons,
 * and a column display mode switcher.
 */
export default function DriveBar(props: DriveBarProps) {
  const {
    backend,
    query,
    setQuery,
    category,
    doEmptyTrash,
    isEmpty,
    shouldDisplayStartModal,
    isDisabled,
  } = props

  const { unsetModal } = useSetModal()
  const { getText } = useText()
  const driveStore = useDriveStore()
  const inputBindings = useInputBindings()
  const dispatchAssetEvent = useDispatchAssetEvent()
  const canCreateAssets = useCanCreateAssets()
  const createAssetButtonsRef = React.useRef<HTMLDivElement>(null)
  const isCloud = isCloudCategory(category)
  const { isOffline } = useOffline()
  const { user } = useFullUserSession()
  const canDownload = useCanDownload()

  const [shouldDisplayExamples, toggleShouldDisplayExamples] = useLocalStorageToggle(
    'displayExamples',
    true,
  )

  const shouldBeDisabled = (isCloud && isOffline) || !canCreateAssets || isDisabled

  const error =
    !shouldBeDisabled ? null
    : isCloud && isOffline ? getText('youAreOffline')
    : getText('cannotCreateAssetsHere')
  const createAssetsVisualTooltip = useVisualTooltip({
    isDisabled: error == null,
    children: error,
    targetRef: createAssetButtonsRef,
    overlayPositionProps: { placement: 'top' },
  })
  const pasteData = usePasteData()
  const effectivePasteData =
    (
      pasteData?.data.backendType === backend.type &&
      canTransferBetweenCategories(pasteData.data.category, category, user)
    ) ?
      pasteData
    : null

  const getTargetDirectory = useEventCallback(() => driveStore.getState().targetDirectory)
  const rootDirectoryId = useRootDirectoryId(backend, category)

  const newFolderRaw = useNewFolder(backend, category)
  const newFolder = useEventCallback(async () => {
    const parent = getTargetDirectory()
    return await newFolderRaw(parent?.directoryId ?? rootDirectoryId, parent?.path)
  })
  const uploadFilesRaw = useUploadFiles(backend, category)
  const uploadFiles = useEventCallback(async (files: readonly File[]) => {
    const parent = getTargetDirectory()
    await uploadFilesRaw(files, parent?.directoryId ?? rootDirectoryId, parent?.path)
  })
  const newSecretRaw = useNewSecret(backend, category)
  const newSecret = useEventCallback(async (name: string, value: string) => {
    const parent = getTargetDirectory()
    return await newSecretRaw(name, value, parent?.directoryId ?? rootDirectoryId, parent?.path)
  })
  const newDatalinkRaw = useNewDatalink(backend, category)
  const newDatalink = useEventCallback(async (name: string, value: unknown) => {
    const parent = getTargetDirectory()
    return await newDatalinkRaw(name, value, parent?.directoryId ?? rootDirectoryId, parent?.path)
  })
  const newProjectRaw = useNewProject(backend, category)
  const newProjectMutation = useMutation({
    mutationKey: ['newProject'],
    mutationFn: async ([templateId, templateName]: [
      templateId: string | null | undefined,
      templateName: string | null | undefined,
    ]) => {
      const parent = getTargetDirectory()
      return await newProjectRaw(
        { templateName, templateId },
        parent?.directoryId ?? rootDirectoryId,
        parent?.path,
      )
    },
  })
  const newProject = newProjectMutation.mutateAsync
  const isCreatingProject = newProjectMutation.isPending

  React.useEffect(() => {
    return inputBindings.attach(sanitizedEventTargets.document.body, 'keydown', {
      ...(isCloud ?
        {
          newFolder: () => {
            void newFolder()
          },
        }
      : {}),
      newProject: () => {
        void newProject([null, null])
      },
      uploadFiles: () => {
        void inputFiles().then((files) => uploadFiles(Array.from(files)))
      },
    })
  }, [inputBindings, isCloud, newFolder, newProject, uploadFiles])

  const searchBar = (
    <AssetSearchBar backend={backend} isCloud={isCloud} query={query} setQuery={setQuery} />
  )

  const assetPanelToggle = (
    <>
      {/* Spacing. */}
      <div className="ml-auto" />
      <AssetPanelToggle showWhen="collapsed" className="my-auto" />
    </>
  )

  const pasteDataStatus = effectivePasteData && (
    <div className="flex items-center">
      <Text>
        {effectivePasteData.type === 'copy' ?
          getText('xItemsCopied', effectivePasteData.data.ids.size)
        : getText('xItemsCut', effectivePasteData.data.ids.size)}
      </Text>
    </div>
  )

  switch (category.type) {
    case 'recent': {
      return (
        <ButtonGroup className="my-0.5 grow-0">
          {pasteDataStatus}
          {searchBar}
          {assetPanelToggle}
        </ButtonGroup>
      )
    }
    case 'trash': {
      return (
        <ButtonGroup className="my-0.5 grow-0">
          <DialogTrigger>
            <Button size="medium" variant="outline" isDisabled={shouldBeDisabled || isEmpty}>
              {getText('clearTrash')}
            </Button>

            <ConfirmDeleteModal
              actionText={getText('allTrashedItemsForever')}
              doDelete={() => {
                doEmptyTrash()
              }}
            />
          </DialogTrigger>
          {pasteDataStatus}
          {searchBar}
          {assetPanelToggle}
        </ButtonGroup>
      )
    }
    case 'cloud':
    case 'local':
    case 'user':
    case 'team':
    case 'local-directory': {
      return (
        <>
          <div className="flex w-full min-w-0 flex-row gap-2">
            <ButtonGroup
              buttonVariants={{ isDisabled: shouldBeDisabled }}
              ref={createAssetButtonsRef}
              verticalAlign="center"
              className="shrink grow-0 basis-0 "
              {...createAssetsVisualTooltip.targetProps}
            >
              <DialogTrigger defaultOpen={shouldDisplayStartModal}>
                <VisuallyHidden>
                  <Button
                    size="medium"
                    variant="outline"
                    isDisabled={shouldBeDisabled || isCreatingProject}
                    icon={Plus2Icon}
                    loaderPosition="icon"
                  >
                    {getText('startWithATemplate')}
                  </Button>
                </VisuallyHidden>

                <StartModal
                  createProject={(templateId, templateName) => {
                    void newProject([templateId, templateName])
                  }}
                />
              </DialogTrigger>

              <WithFeatureFlag flag="newProjectButtonView" showIf={['tab_bar', 'table']}>
                <Button variant="outline" icon={Plus2Icon}>
                  {getText('newEmptyProject')}
                </Button>
              </WithFeatureFlag>

              <WithFeatureFlag flag="newProjectButtonView" showIf="popover">
                <Popover.Trigger>
                  <Button variant="accent" icon={Plus2Icon} iconPosition="start">
                    {getText('newEmptyProject')}
                  </Button>

                  <Popover size="xxxlarge">
                    <div className="flex w-full flex-col gap-4">
                      <Text variant="h1">{getText('chooseATemplate')}</Text>
                      <Form
                        schema={z.object({
                          templateId: z.string().optional(),
                          name: z.string().min(1),
                        })}
                        defaultValues={{
                          name: 'New Project',
                        }}
                        onSubmit={async (values) => {
                          await newProject([values.templateId, values.name])
                          close()
                        }}
                      >
                        <div className="flex w-full flex-col gap-1">
                          <Text variant="subtitle">{getText('basicTemplates')}</Text>
                          <TemplatesCarousel
                            className="-mx-12 w-auto px-12"
                            group="Get Started"
                            isDisabled={shouldBeDisabled || isCreatingProject}
                            onSelectTemplate={async (templateId, templateName) => {
                              await newProject([templateId, templateName])
                            }}
                          />
                        </div>

                        <div className="flex w-full flex-col gap-1">
                          <Text variant="subtitle">{getText('advancedTemplates')}</Text>
                          <TemplatesCarousel
                            group={['Examples', 'Advanced']}
                            className="-mx-12 w-auto px-12"
                            isDisabled={shouldBeDisabled || isCreatingProject}
                            onSelectTemplate={async (templateId, templateName) => {
                              await newProject([templateId, templateName])
                            }}
                          />
                        </div>
                      </Form>
                    </div>
                  </Popover>
                </Popover.Trigger>
              </WithFeatureFlag>

              <WithFeatureFlag flag="newProjectButtonView" showIf="expand">
                {/* <Button.Group
                  className="shrink grow-0 basis-0"
                  buttonVariants={{
                    isDisabled: shouldBeDisabled || isCreatingProject,
                    variant: 'outline',
                  }}
                > */}
                <Button
                  variant="icon"
                  icon={shouldDisplayExamples ? ExpandArrowDownIcon : ExpandArrowRightIcon}
                  onPress={toggleShouldDisplayExamples}
                />
                {/* </Button.Group> */}
              </WithFeatureFlag>

              <WithFeatureFlag flag="newProjectButtonView" showIf="button_with_popover">
                <Button.GroupJoin
                  buttonVariants={{
                    isDisabled: shouldBeDisabled || isCreatingProject,
                    size: 'medium',
                    variant: 'accent',
                  }}
                >
                  <Button
                    icon={Plus2Icon}
                    onPress={async () => {
                      await newProject([null, null])
                    }}
                  >
                    {getText('newEmptyProject')}
                  </Button>

                  <Popover.Trigger>
                    <Button icon={ExpandArrowDownIcon} />

                    <Popover size="xlarge">
                      {({ close }) => (
                        <div className="flex w-full flex-col gap-4">
                          <Text variant="subtitle">{getText('newEmptyProject')}</Text>
                          <Form
                            schema={z.object({
                              templateId: z.string().optional(),
                              name: z.string().min(1),
                            })}
                            defaultValues={{
                              name: 'New Project',
                            }}
                            onSubmit={async (values) => {
                              await newProject([values.templateId, values.name])
                              close()
                            }}
                          >
                            <TemplatesCarousel
                              isDisabled={shouldBeDisabled || isCreatingProject}
                              onSelectTemplate={async (templateId, templateName) => {
                                await newProject([templateId, templateName])
                              }}
                            />

                            <Input name="name" label={getText('projectName')} autoFocus />

                            <Form.Submit>{getText('create')}</Form.Submit>
                          </Form>
                        </div>
                      )}
                    </Popover>
                  </Popover.Trigger>
                </Button.GroupJoin>
              </WithFeatureFlag>

              <Button variant="primary" size="medium" icon={Plus2Icon} iconPosition="end">
                {getText('newEmptyProject')}
              </Button>

              <div className="flex h-full flex-initial items-center gap-4 rounded-full border-0.5 border-primary/20 px-[11px]">
                <Button
                  variant="icon"
                  size="medium"
                  icon={AddFolderIcon}
                  aria-label={getText('newFolder')}
                  onPress={async () => {
                    await newFolder()
                  }}
                />
                {isCloud && (
                  <DialogTrigger>
                    <Button
                      variant="icon"
                      size="medium"
                      icon={AddKeyIcon}
                      aria-label={getText('newSecret')}
                    />
                    <UpsertSecretModal
                      id={null}
                      name={null}
                      doCreate={async (name, value) => {
                        await newSecret(name, value)
                      }}
                    />
                  </DialogTrigger>
                )}

                {isCloud && (
                  <DialogTrigger>
                    <Button
                      variant="icon"
                      size="medium"
                      icon={AddDatalinkIcon}
                      aria-label={getText('newDatalink')}
                    />
                    <UpsertDatalinkModal
                      doCreate={async (name, value) => {
                        await newDatalink(name, value)
                      }}
                    />
                  </DialogTrigger>
                )}

                <Button
                  variant="icon"
                  size="medium"
                  icon={DataUploadIcon}
                  aria-label={getText('uploadFiles')}
                  onPress={async () => {
                    const files = await inputFiles()
                    await uploadFiles(Array.from(files))
                  }}
                />
                <Button
                  isDisabled={!canDownload || shouldBeDisabled}
                  variant="icon"
                  size="medium"
                  icon={DataDownloadIcon}
                  aria-label={getText('downloadFiles')}
                  onPress={() => {
                    unsetModal()
                    dispatchAssetEvent({ type: AssetEventType.downloadSelected })
                  }}
                />
              </div>
              {createAssetsVisualTooltip.tooltip}
            </ButtonGroup>
            {pasteDataStatus}
            {searchBar}
            {assetPanelToggle}
          </div>

          <WithFeatureFlag flag="newProjectButtonView" showIf="expand">
            {shouldDisplayExamples && (
              <div className="flex min-h-0 w-full min-w-0 max-w-full flex-none flex-col gap-2">
                <Text variant="subtitle">{getText('startWithTemplate')}</Text>
                <TemplatesCarousel
                  className="-mx-4 w-auto px-4"
                  isDisabled={shouldBeDisabled || isCreatingProject}
                  onSelectTemplate={async (templateId, templateName) => {
                    await newProject([templateId, templateName])
                  }}
                />
              </div>
            )}
          </WithFeatureFlag>
        </>
      )
    }
  }
}
