/** @file Switcher to choose the currently visible assets table category. */
import { memo, useMemo, useTransition, type ReactNode } from 'react'

import { useSearchParams } from 'react-router-dom'
import { twJoin } from 'tailwind-merge'
import * as z from 'zod'

import {
  AssetType,
  DirectoryId,
  FilterBy,
  Path,
  Plan,
  userHasUserAndTeamSpaces,
  type AssetId,
  type User,
  type UserGroupInfo,
} from 'enso-common/src/services/Backend'
import { getFileName } from 'enso-common/src/utilities/data/fileInfo'

import { SEARCH_PARAMS_PREFIX } from '#/appUtils'
import CloudIcon from '#/assets/cloud.svg'
import ComputerIcon from '#/assets/computer.svg'
import FolderAddIcon from '#/assets/folder_add.svg'
import FolderFilledIcon from '#/assets/folder_filled.svg'
import Minus2Icon from '#/assets/minus2.svg'
import PeopleIcon from '#/assets/people.svg'
import PersonIcon from '#/assets/person.svg'
import RecentIcon from '#/assets/recent.svg'
import SettingsIcon from '#/assets/settings.svg'
import Trash2Icon from '#/assets/trash2.svg'
import { AnimatedBackground } from '#/components/AnimatedBackground'
import { DropZone, type DropEvent } from '#/components/aria'
import { BUTTON_STYLES, Button, DialogTrigger, Text } from '#/components/AriaComponents'
import { Badge } from '#/components/Badge'
import { ASSETS_MIME_TYPE } from '#/data/mimeTypes'
import { useBackendQuery } from '#/hooks/backendHooks'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { useOffline } from '#/hooks/offlineHooks'
import {
  areCategoriesEqual,
  canTransferBetweenCategories,
  useTransferBetweenCategories,
  type Category,
} from '#/layouts/CategorySwitcher/Category'
import { useDispatchAssetEvent } from '#/layouts/Drive/EventListProvider'
import ConfirmDeleteModal from '#/modals/ConfirmDeleteModal'
import { useFullUserSession } from '#/providers/AuthProvider'
import { useLocalBackend, useRemoteBackend } from '#/providers/BackendProvider'
import { useLocalStorageState } from '#/providers/LocalStorageProvider'
import { useSetModal } from '#/providers/ModalProvider'
import { TabType } from '#/providers/ProjectsProvider'
import { useText } from '#/providers/TextProvider'
import { newDirectoryId } from '#/services/LocalBackend'
import { TEAMS_DIRECTORY_ID, USERS_DIRECTORY_ID } from '#/services/remoteBackendPaths'
import LocalStorage from '#/utilities/LocalStorage'
import { tv } from '#/utilities/tailwindVariants'

// ============================
// === Global configuration ===
// ============================

declare module '#/utilities/LocalStorage' {
  /** */
  interface LocalStorageData {
    readonly localRootDirectories: readonly string[]
  }
}

LocalStorage.registerKey('localRootDirectories', { schema: z.string().array().readonly() })

// ========================
// === CategoryMetadata ===
// ========================

/** Metadata for a categoryModule.categoryType. */
interface CategoryMetadata {
  readonly isNested?: boolean
  readonly category: Category
  readonly icon: string
  readonly label: string
  readonly buttonLabel: string
  readonly dropZoneLabel: string
  readonly className?: string
  readonly iconClassName?: string
}

// ============================
// === CategorySwitcherItem ===
// ============================

/** Props for a {@link CategorySwitcherItem}. */
interface InternalCategorySwitcherItemProps extends CategoryMetadata {
  readonly currentCategory: Category
  readonly setCategory: (category: Category) => void
  readonly badgeContent?: ReactNode
}

const CATEGORY_SWITCHER_VARIANTS = tv({
  extend: BUTTON_STYLES,
  base: 'group opacity-50 transition-opacity group-hover:opacity-100 w-auto max-w-full',
  slots: {
    wrapper: 'w-full',
    text: 'flex-1 min-w-0 w-auto items-start justify-start',
  },
})

/** An entry in a {@link CategorySwitcher}. */
function CategorySwitcherItem(props: InternalCategorySwitcherItemProps) {
  const { currentCategory, setCategory, badgeContent } = props
  const { isNested = false, category, icon, label, buttonLabel, dropZoneLabel } = props

  const [isTransitioning, startTransition] = useTransition()

  const { user } = useFullUserSession()
  const { unsetModal } = useSetModal()
  const { getText } = useText()
  const localBackend = useLocalBackend()
  const { isOffline } = useOffline()
  const isCurrent = areCategoriesEqual(currentCategory, category)
  const transferBetweenCategories = useTransferBetweenCategories(currentCategory)
  const getCategoryError = useEventCallback((otherCategory: Category) => {
    switch (otherCategory.type) {
      case 'local':
      case 'local-directory': {
        if (localBackend == null) {
          return getText('localBackendNotDetectedError')
        } else {
          return null
        }
      }
      case 'cloud':
      case 'recent':
      case 'trash':
      case 'user':
      case 'team': {
        if (isOffline) {
          return getText('unavailableOffline')
        } else if (!user.isEnabled) {
          return getText('notEnabledSubtitle')
        } else {
          return null
        }
      }
    }
  })
  const error = getCategoryError(category)
  const isDisabled = error != null
  const tooltip = error ?? false

  const isDropTarget =
    !areCategoriesEqual(currentCategory, category) &&
    canTransferBetweenCategories(currentCategory, category, user)
  const acceptedDragTypes = isDropTarget ? [ASSETS_MIME_TYPE] : []

  const onPress = useEventCallback(() => {
    if (error == null && !areCategoriesEqual(category, currentCategory)) {
      // We use startTransition to trigger a background transition between categories.
      // and to not invoke the Suspense boundary.
      // This makes the transition feel more responsive and natural.
      startTransition(() => {
        setCategory(category)
      })
    }
  })

  const onDrop = useEventCallback((event: DropEvent) => {
    unsetModal()
    void Promise.all(
      event.items.flatMap(async (item) => {
        if (item.kind === 'text') {
          const text = await item.getText(ASSETS_MIME_TYPE)
          const payload: unknown = JSON.parse(text)
          return Array.isArray(payload) ?
              payload.flatMap((key) =>
                // This is SAFE, assuming only this app creates payloads with
                // the specific mimetype above.
                // eslint-disable-next-line no-restricted-syntax
                typeof key === 'string' ? [key as AssetId] : [],
              )
            : []
        } else {
          return []
        }
      }),
    ).then((keys) => {
      transferBetweenCategories(currentCategory, category, keys.flat(1))
    })
  })

  const element = (
    <DropZone
      aria-label={dropZoneLabel}
      getDropOperation={(types) =>
        acceptedDragTypes.some((type) => types.has(type)) ? 'move' : 'cancel'
      }
      className="group relative flex w-full min-w-0 flex-auto items-start rounded-full drop-target-after"
      onDrop={onDrop}
    >
      <AnimatedBackground.Item
        isSelected={isCurrent}
        className="w-auto max-w-[calc(100%-24px)]"
        animationClassName="bg-invert rounded-full"
      >
        <Button
          size="medium"
          variant="custom"
          tooltip={tooltip}
          tooltipPlacement="right"
          variants={CATEGORY_SWITCHER_VARIANTS}
          isDisabled={isDisabled}
          aria-label={buttonLabel}
          onPress={onPress}
          loaderPosition="icon"
          loading={isTransitioning}
          className={twJoin(isCurrent && 'opacity-100')}
          icon={icon}
          addonEnd={
            badgeContent != null && (
              <Badge color="accent" variant="solid">
                {badgeContent}
              </Badge>
            )
          }
        >
          <Text disableLineHeightCompensation weight="semibold" color="current" truncate="1">
            {label}
          </Text>
        </Button>
      </AnimatedBackground.Item>
      <div className="absolute left-full ml-2 hidden group-focus-visible:block">
        {getText('drop')}
      </div>
    </DropZone>
  )

  return isNested ?
      <div className="flex w-full min-w-0 max-w-full flex-1">
        <div className="ml-[15px] mr-1.5 rounded-full border-r border-primary/20" />
        {element}
      </div>
    : element
}

// ========================
// === CategorySwitcher ===
// ========================

/** Props for a {@link CategorySwitcher}. */
export interface CategorySwitcherProps {
  readonly category: Category
  readonly setCategory: (category: Category) => void
}

/** A switcher to choose the currently visible assets table categoryModule.categoryType. */
function CategorySwitcher(props: CategorySwitcherProps) {
  const { category, setCategory } = props
  const { user } = useFullUserSession()
  const { getText } = useText()
  const remoteBackend = useRemoteBackend()
  const dispatchAssetEvent = useDispatchAssetEvent()
  const [, setSearchParams] = useSearchParams()
  const [localRootDirectories, setLocalRootDirectories] =
    useLocalStorageState('localRootDirectories')
  const hasUserAndTeamSpaces = userHasUserAndTeamSpaces(user)

  const localBackend = useLocalBackend()
  const itemProps = { currentCategory: category, setCategory, dispatchAssetEvent }
  const selfDirectoryId = DirectoryId(`directory-${user.userId.replace(/^user-/, '')}`)

  const { data: users } = useBackendQuery(remoteBackend, 'listUsers', [])
  const { data: teams } = useBackendQuery(remoteBackend, 'listUserGroups', [])
  const usersById = useMemo<ReadonlyMap<DirectoryId, User>>(
    () =>
      new Map(
        (users ?? []).map((otherUser) => [
          DirectoryId(`directory-${otherUser.userId.replace(/^user-/, '')}`),
          otherUser,
        ]),
      ),
    [users],
  )
  const teamsById = useMemo<ReadonlyMap<DirectoryId, UserGroupInfo>>(
    () =>
      new Map(
        (teams ?? []).map((team) => [
          DirectoryId(`directory-${team.id.replace(/^usergroup-/, '')}`),
          team,
        ]),
      ),
    [teams],
  )
  const usersDirectoryQuery = useBackendQuery(
    remoteBackend,
    'listDirectory',
    [
      {
        parentId: USERS_DIRECTORY_ID,
        filterBy: FilterBy.active,
        labels: null,
        recentProjects: false,
      },
      'Users',
    ],
    { enabled: hasUserAndTeamSpaces },
  )
  const teamsDirectoryQuery = useBackendQuery(
    remoteBackend,
    'listDirectory',
    [
      {
        parentId: TEAMS_DIRECTORY_ID,
        filterBy: FilterBy.active,
        labels: null,
        recentProjects: false,
      },
      'Teams',
    ],
    { enabled: hasUserAndTeamSpaces },
  )

  return (
    <div className="flex flex-col gap-2 py-1">
      <AnimatedBackground>
        <Text variant="subtitle" weight="semibold" className="px-2">
          {getText('category')}
        </Text>

        <div
          aria-label={getText('categorySwitcherMenuLabel')}
          role="grid"
          className="flex flex-col items-start"
        >
          <CategorySwitcherItem
            {...itemProps}
            category={{ type: 'cloud' }}
            icon={CloudIcon}
            label={getText('cloudCategory')}
            buttonLabel={getText('cloudCategoryButtonLabel')}
            dropZoneLabel={getText('cloudCategoryDropZoneLabel')}
            badgeContent={getText('cloudCategoryBadgeContent')}
          />
          {(user.plan === Plan.team || user.plan === Plan.enterprise) && (
            <CategorySwitcherItem
              {...itemProps}
              isNested
              category={{
                type: 'user',
                rootPath: Path(`enso://Users/${user.name}`),
                homeDirectoryId: selfDirectoryId,
              }}
              icon={PersonIcon}
              label={getText('myFilesCategory')}
              buttonLabel={getText('myFilesCategoryButtonLabel')}
              dropZoneLabel={getText('myFilesCategoryDropZoneLabel')}
            />
          )}
          {usersDirectoryQuery.data?.map((userDirectory) => {
            if (userDirectory.type !== AssetType.directory) {
              return null
            } else {
              const otherUser = usersById.get(userDirectory.id)
              return !otherUser || otherUser.userId === user.userId ?
                  null
                : <CategorySwitcherItem
                    key={otherUser.userId}
                    {...itemProps}
                    isNested
                    category={{
                      type: 'user',
                      rootPath: Path(`enso://Users/${otherUser.name}`),
                      homeDirectoryId: userDirectory.id,
                    }}
                    icon={PersonIcon}
                    label={getText('userCategory', otherUser.name)}
                    buttonLabel={getText('userCategoryButtonLabel', otherUser.name)}
                    dropZoneLabel={getText('userCategoryDropZoneLabel', otherUser.name)}
                  />
            }
          })}
          {teamsDirectoryQuery.data?.map((teamDirectory) => {
            if (teamDirectory.type !== AssetType.directory) {
              return null
            } else {
              const team = teamsById.get(teamDirectory.id)
              return !team ? null : (
                  <CategorySwitcherItem
                    key={team.id}
                    {...itemProps}
                    isNested
                    category={{
                      type: 'team',
                      team,
                      rootPath: Path(`enso://Teams/${team.groupName}`),
                      homeDirectoryId: teamDirectory.id,
                    }}
                    icon={PeopleIcon}
                    label={getText('teamCategory', team.groupName)}
                    buttonLabel={getText('teamCategoryButtonLabel', team.groupName)}
                    dropZoneLabel={getText('teamCategoryDropZoneLabel', team.groupName)}
                  />
                )
            }
          })}
          <CategorySwitcherItem
            {...itemProps}
            isNested
            category={{ type: 'recent' }}
            icon={RecentIcon}
            label={getText('recentCategory')}
            buttonLabel={getText('recentCategoryButtonLabel')}
            dropZoneLabel={getText('recentCategoryDropZoneLabel')}
          />
          <CategorySwitcherItem
            {...itemProps}
            isNested
            category={{ type: 'trash' }}
            icon={Trash2Icon}
            label={getText('trashCategory')}
            buttonLabel={getText('trashCategoryButtonLabel')}
            dropZoneLabel={getText('trashCategoryDropZoneLabel')}
          />

          {localBackend && (
            <div className="group flex items-center gap-2 self-stretch drop-target-after">
              <CategorySwitcherItem
                {...itemProps}
                category={{ type: 'local' }}
                icon={ComputerIcon}
                label={getText('localCategory')}
                buttonLabel={getText('localCategoryButtonLabel')}
                dropZoneLabel={getText('localCategoryDropZoneLabel')}
              />

              <Button
                size="medium"
                variant="icon"
                extraClickZone="small"
                icon={SettingsIcon}
                aria-label={getText('changeLocalRootDirectoryInSettings')}
                className="my-auto opacity-0 transition-opacity group-hover:opacity-100"
                onPress={() => {
                  setSearchParams({
                    [`${SEARCH_PARAMS_PREFIX}SettingsTab`]: JSON.stringify('local'),
                    [`${SEARCH_PARAMS_PREFIX}page`]: JSON.stringify(TabType.settings),
                  })
                }}
              />
            </div>
          )}
          {localBackend &&
            localRootDirectories?.map((directory) => (
              <div key={directory} className="group flex items-center gap-2 self-stretch">
                <CategorySwitcherItem
                  {...itemProps}
                  isNested
                  category={{
                    type: 'local-directory',
                    rootPath: Path(directory),
                    homeDirectoryId: newDirectoryId(Path(directory)),
                  }}
                  icon={FolderFilledIcon}
                  label={getFileName(directory)}
                  buttonLabel={getText('localCategoryButtonLabel')}
                  dropZoneLabel={getText('localCategoryDropZoneLabel')}
                />
                <DialogTrigger>
                  <Button
                    size="medium"
                    variant="icon"
                    extraClickZone={false}
                    icon={Minus2Icon}
                    aria-label={getText('removeDirectoryFromFavorites')}
                    className="hidden group-hover:block"
                  />
                  <ConfirmDeleteModal
                    actionText={getText(
                      'removeTheLocalDirectoryXFromFavorites',
                      getFileName(directory),
                    )}
                    actionButtonLabel={getText('remove')}
                    doDelete={() => {
                      setLocalRootDirectories(
                        localRootDirectories.filter(
                          (otherDirectory) => otherDirectory !== directory,
                        ),
                      )
                    }}
                  />
                </DialogTrigger>
              </div>
            ))}
          {localBackend && window.fileBrowserApi && (
            <div className="flex">
              <div className="ml-[15px] mr-1.5 rounded-full border-r border-primary/20" />
              <Button
                size="medium"
                variant="icon"
                icon={FolderAddIcon}
                loaderPosition="icon"
                onPress={async () => {
                  const [newDirectory] =
                    (await window.fileBrowserApi?.openFileBrowser('directory')) ?? []
                  if (newDirectory != null) {
                    setLocalRootDirectories([...(localRootDirectories ?? []), newDirectory])
                  }
                }}
              >
                {getText('addLocalDirectory')}
              </Button>
            </div>
          )}
        </div>
      </AnimatedBackground>
    </div>
  )
}

export default memo(CategorySwitcher)
