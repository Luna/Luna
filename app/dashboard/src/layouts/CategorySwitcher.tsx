/** @file Switcher to choose the currently visible assets table category. */
import * as React from 'react'

import { useSearchParams } from 'react-router-dom'

import CloudIcon from '#/assets/cloud.svg'
import ComputerIcon from '#/assets/computer.svg'
import PeopleIcon from '#/assets/people.svg'
import PersonIcon from '#/assets/person.svg'
import RecentIcon from '#/assets/recent.svg'
import SettingsIcon from '#/assets/settings.svg'
import Trash2Icon from '#/assets/trash2.svg'
import * as aria from '#/components/aria'
import * as ariaComponents from '#/components/AriaComponents'
import FocusArea from '#/components/styled/FocusArea'
import SvgMask from '#/components/SvgMask'
import * as mimeTypes from '#/data/mimeTypes'
import AssetEventType from '#/events/AssetEventType'
import {
  useBackendQuery,
  useListUserGroups,
  useListUsers,
  type WithPlaceholder,
} from '#/hooks/backendHooks'
import * as offlineHooks from '#/hooks/offlineHooks'
import * as eventListProvider from '#/layouts/AssetsTable/EventListProvider'
import type Category from '#/layouts/CategorySwitcher/Category'
import * as categoryModule from '#/layouts/CategorySwitcher/Category'
import * as authProvider from '#/providers/AuthProvider'
import * as backendProvider from '#/providers/BackendProvider'
import * as modalProvider from '#/providers/ModalProvider'
import { TabType, useSetPage } from '#/providers/ProjectsProvider'
import * as textProvider from '#/providers/TextProvider'
import * as backend from '#/services/Backend'
import { TEAMS_DIRECTORY_ID, USERS_DIRECTORY_ID } from '#/services/remoteBackendPaths'
import * as tailwindMerge from '#/utilities/tailwindMerge'

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
}

/** An entry in a {@link CategorySwitcher}. */
function CategorySwitcherItem(props: InternalCategorySwitcherItemProps) {
  const { currentCategory, setCategory } = props
  const { isNested = false, category, icon, label, buttonLabel, dropZoneLabel } = props
  const { iconClassName } = props
  const { user } = authProvider.useFullUserSession()
  const { unsetModal } = modalProvider.useSetModal()
  const { getText } = textProvider.useText()
  const localBackend = backendProvider.useLocalBackend()
  const { isOffline } = offlineHooks.useOffline()
  const isCurrent = categoryModule.areCategoriesEqual(currentCategory, category)
  const dispatchAssetEvent = eventListProvider.useDispatchAssetEvent()
  const getCategoryError = (otherCategory: Category) => {
    switch (otherCategory.type) {
      case categoryModule.CategoryType.local: {
        if (localBackend == null) {
          return getText('localBackendNotDetectedError')
        } else {
          return null
        }
      }
      case categoryModule.CategoryType.cloud:
      case categoryModule.CategoryType.recent:
      case categoryModule.CategoryType.trash:
      case categoryModule.CategoryType.user:
      case categoryModule.CategoryType.team: {
        if (isOffline) {
          return getText('unavailableOffline')
        } else if (!user.isEnabled) {
          return getText('notEnabledSubtitle')
        } else {
          return null
        }
      }
    }
  }
  const error = getCategoryError(category)
  const isDisabled = error != null
  const tooltip = error ?? false

  const isDropTarget = (() => {
    if (categoryModule.areCategoriesEqual(category, currentCategory)) {
      return false
    } else if (currentCategory.type === categoryModule.CategoryType.trash) {
      switch (category.type) {
        case categoryModule.CategoryType.trash:
        case categoryModule.CategoryType.recent: {
          return false
        }
        default: {
          return true
        }
      }
    } else {
      return category.type !== categoryModule.CategoryType.recent
    }
  })()
  const acceptedDragTypes = isDropTarget ? [mimeTypes.ASSETS_MIME_TYPE] : []

  const onPress = () => {
    if (error == null && !categoryModule.areCategoriesEqual(category, currentCategory)) {
      setCategory(category)
    }
  }

  const onDrop = (event: aria.DropEvent) => {
    unsetModal()
    void Promise.all(
      event.items.flatMap(async (item) => {
        if (item.kind === 'text') {
          const text = await item.getText(mimeTypes.ASSETS_MIME_TYPE)
          const payload: unknown = JSON.parse(text)
          return Array.isArray(payload) ?
              payload.flatMap((key) =>
                // This is SAFE, assuming only this app creates payloads with
                // the specific mimetype above.
                // eslint-disable-next-line no-restricted-syntax
                typeof key === 'string' ? [key as backend.AssetId] : [],
              )
            : []
        } else {
          return []
        }
      }),
    ).then((keys) => {
      dispatchAssetEvent({
        type:
          currentCategory.type === categoryModule.CategoryType.trash ?
            AssetEventType.restore
          : AssetEventType.delete,
        ids: new Set(keys.flat(1)),
      })
    })
  }

  const element = (
    <aria.DropZone
      aria-label={dropZoneLabel}
      getDropOperation={(types) =>
        acceptedDragTypes.some((type) => types.has(type)) ? 'move' : 'cancel'
      }
      className="group relative flex items-center rounded-full drop-target-after"
      onDrop={onDrop}
    >
      <ariaComponents.Button
        size="custom"
        variant="custom"
        tooltip={tooltip}
        tooltipPlacement="right"
        className={tailwindMerge.twMerge(
          isCurrent && 'focus-default',
          isDisabled && 'cursor-not-allowed hover:bg-transparent',
        )}
        aria-label={buttonLabel}
        onPress={onPress}
      >
        <div
          className={tailwindMerge.twMerge(
            'group flex h-row items-center gap-icon-with-text rounded-full px-button-x selectable',
            isCurrent && 'disabled active',
            !isCurrent && !isDisabled && 'hover:bg-selected-frame',
          )}
        >
          <SvgMask src={icon} className={iconClassName} />
          <aria.Text slot="description">{label}</aria.Text>
        </div>
      </ariaComponents.Button>
      <div className="absolute left-full ml-2 hidden group-focus-visible:block">
        {getText('drop')}
      </div>
    </aria.DropZone>
  )

  return isNested ?
      <div className="flex">
        <div className="ml-[15px] mr-1 border-r border-primary/20" />
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
export default function CategorySwitcher(props: CategorySwitcherProps) {
  const { category, setCategory } = props
  const { user } = authProvider.useFullUserSession()
  const { getText } = textProvider.useText()
  const remoteBackend = backendProvider.useRemoteBackendStrict()
  const dispatchAssetEvent = eventListProvider.useDispatchAssetEvent()
  const setPage = useSetPage()
  const [, setSearchParams] = useSearchParams()

  const localBackend = backendProvider.useLocalBackend()
  const itemProps = { currentCategory: category, setCategory, dispatchAssetEvent }
  const selfDirectoryId = backend.DirectoryId(`directory-${user.userId.replace(/^user-/, '')}`)

  const users = useListUsers(remoteBackend)
  const teams = useListUserGroups(remoteBackend)
  const usersById = React.useMemo<ReadonlyMap<backend.DirectoryId, WithPlaceholder<backend.User>>>(
    () =>
      new Map(
        (users ?? []).map((otherUser) => [
          backend.DirectoryId(`directory-${otherUser.userId.replace(/^user-/, '')}`),
          otherUser,
        ]),
      ),
    [users],
  )
  const teamsById = React.useMemo<
    ReadonlyMap<backend.DirectoryId, WithPlaceholder<backend.UserGroupInfo>>
  >(
    () =>
      new Map(
        (teams ?? []).map((team) => [
          backend.DirectoryId(`directory-${team.id.replace(/^usergroup-/, '')}`),
          team,
        ]),
      ),
    [teams],
  )
  const usersDirectoryQuery = useBackendQuery(remoteBackend, 'listDirectory', [
    {
      parentId: backend.DirectoryId(USERS_DIRECTORY_ID),
      filterBy: backend.FilterBy.active,
      labels: [],
      recentProjects: false,
    },
    'Users',
  ])
  const teamsDirectoryQuery = useBackendQuery(remoteBackend, 'listDirectory', [
    {
      parentId: backend.DirectoryId(TEAMS_DIRECTORY_ID),
      filterBy: backend.FilterBy.active,
      labels: [],
      recentProjects: false,
    },

    'Teams',
  ])

  return (
    <FocusArea direction="vertical">
      {(innerProps) => (
        <div className="flex w-full flex-col gap-2 py-1" {...innerProps}>
          <ariaComponents.Text variant="subtitle" className="px-2 font-bold">
            {getText('category')}
          </ariaComponents.Text>

          <div
            aria-label={getText('categorySwitcherMenuLabel')}
            role="grid"
            className="flex flex-col items-start"
          >
            <CategorySwitcherItem
              {...itemProps}
              category={{ type: categoryModule.CategoryType.cloud }}
              icon={CloudIcon}
              label={getText('cloudCategory')}
              buttonLabel={getText('cloudCategoryButtonLabel')}
              dropZoneLabel={getText('cloudCategoryDropZoneLabel')}
            />
            {(user.plan === backend.Plan.team || user.plan === backend.Plan.enterprise) && (
              <CategorySwitcherItem
                {...itemProps}
                isNested
                category={{
                  type: categoryModule.CategoryType.user,
                  rootPath: backend.Path(`enso://Users/${user.name}`),
                  homeDirectoryId: selfDirectoryId,
                }}
                icon={PersonIcon}
                label={getText('myFilesCategory')}
                buttonLabel={getText('myFilesCategoryButtonLabel')}
                dropZoneLabel={getText('myFilesCategoryDropZoneLabel')}
              />
            )}
            <CategorySwitcherItem
              {...itemProps}
              isNested
              category={{ type: categoryModule.CategoryType.recent }}
              icon={RecentIcon}
              label={getText('recentCategory')}
              buttonLabel={getText('recentCategoryButtonLabel')}
              dropZoneLabel={getText('recentCategoryDropZoneLabel')}
              iconClassName="-ml-0.5"
            />
            <CategorySwitcherItem
              {...itemProps}
              isNested
              category={{ type: categoryModule.CategoryType.trash }}
              icon={Trash2Icon}
              label={getText('trashCategory')}
              buttonLabel={getText('trashCategoryButtonLabel')}
              dropZoneLabel={getText('trashCategoryDropZoneLabel')}
            />
            {usersDirectoryQuery.data?.map((userDirectory) => {
              if (userDirectory.type !== backend.AssetType.directory) {
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
                        type: categoryModule.CategoryType.user,
                        rootPath: backend.Path(`enso://Users/${otherUser.name}`),
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
              if (teamDirectory.type !== backend.AssetType.directory) {
                return null
              } else {
                const team = teamsById.get(teamDirectory.id)
                return !team ? null : (
                    <CategorySwitcherItem
                      key={team.id}
                      {...itemProps}
                      isNested
                      category={{
                        type: categoryModule.CategoryType.team,
                        team,
                        rootPath: backend.Path(`enso://Teams/${team.groupName}`),
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
            {localBackend != null && (
              <div className="group flex items-center justify-between self-stretch">
                <CategorySwitcherItem
                  {...itemProps}
                  category={{ type: categoryModule.CategoryType.local }}
                  icon={ComputerIcon}
                  label={getText('localCategory')}
                  buttonLabel={getText('localCategoryButtonLabel')}
                  dropZoneLabel={getText('localCategoryDropZoneLabel')}
                />
                <ariaComponents.Button
                  size="medium"
                  variant="icon"
                  icon={SettingsIcon}
                  aria-label={getText('changeLocalRootDirectoryInSettings')}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onPress={() => {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    setSearchParams({ 'cloud-ide_SettingsTab': '"local"' })
                    setPage(TabType.settings)
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </FocusArea>
  )
}
