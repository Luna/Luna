/**
 * @file
 *
 * Hooks for working with categories.
 * Categories are shortcuts to specific directories in the Cloud, e.g. team spaces, recent and trash
 * It's not the same as the categories like LocalBackend
 */

import { useSuspenseQuery } from '@tanstack/react-query'

import CloudIcon from '#/assets/cloud.svg'
import ComputerIcon from '#/assets/computer.svg'
import FolderFilledIcon from '#/assets/folder_filled.svg'
import PeopleIcon from '#/assets/people.svg'
import PersonIcon from '#/assets/person.svg'
import RecentIcon from '#/assets/recent.svg'
import Trash2Icon from '#/assets/trash2.svg'

import { useUser } from '#/providers/AuthProvider'

import { backendQueryOptions } from '#/hooks/backendHooks'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { useOffline } from '#/hooks/offlineHooks'
import { useSearchParamsState } from '#/hooks/searchParamsStateHooks'
import { useBackend, useLocalBackend, useRemoteBackend } from '#/providers/BackendProvider'
import { useLocalStorageState } from '#/providers/LocalStorageProvider'
import { useText } from '#/providers/TextProvider'
import type Backend from '#/services/Backend'
import { type DirectoryId, Path, userHasUserAndTeamSpaces } from '#/services/Backend'
import { newDirectoryId } from '#/services/LocalBackend'
import {
  organizationIdToDirectoryId,
  userGroupIdToDirectoryId,
  userIdToDirectoryId,
} from '#/services/RemoteBackend'
import { getFileName } from '#/utilities/fileInfo'
import LocalStorage from '#/utilities/LocalStorage'
import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'
import invariant from 'tiny-invariant'
import { z } from 'zod'
import type {
  AnyCloudCategory,
  AnyLocalCategory,
  Category,
  CategoryByType,
  CategoryId,
  CloudCategory,
  LocalCategory,
  LocalDirectoryCategory,
  RecentCategory,
  TeamCategory,
  TrashCategory,
  UserCategory,
} from './Category'
import { isCloudCategory, isLocalCategory } from './Category'

declare module '#/utilities/LocalStorage' {
  /** */
  interface LocalStorageData {
    readonly localRootDirectories: z.infer<typeof LOCAL_ROOT_DIRECTORIES_SCHEMA>
  }
}

const LOCAL_ROOT_DIRECTORIES_SCHEMA = z.string().array().readonly()

LocalStorage.registerKey('localRootDirectories', { schema: LOCAL_ROOT_DIRECTORIES_SCHEMA })

/**
 * Result of the useCloudCategoryList hook.
 */
export type CloudCategoryResult = ReturnType<typeof useCloudCategoryList>

/**
 * List of categories in the Cloud.
 */
export function useCloudCategoryList() {
  const remoteBackend = useRemoteBackend()

  const user = useUser()
  const { getText } = useText()

  const { name, userId, organizationId } = user

  const hasUserAndTeamSpaces = userHasUserAndTeamSpaces(user)

  const homeDirectoryId =
    hasUserAndTeamSpaces ? organizationIdToDirectoryId(organizationId) : userIdToDirectoryId(userId)

  const cloudCategory: CloudCategory = {
    type: 'cloud',
    id: 'cloud',
    label: getText('cloudCategory'),
    icon: CloudIcon,
    rootPath: Path(`enso://${hasUserAndTeamSpaces ? `Users/${user.name}` : ''}`),
    homeDirectoryId,
  }

  const recentCategory: RecentCategory = {
    type: 'recent',
    id: 'recent',
    label: getText('recentCategory'),
    rootPath: Path(`(Recent)`),
    icon: RecentIcon,
  }

  const trashCategory: TrashCategory = {
    type: 'trash',
    id: 'trash',
    label: getText('trashCategory'),
    rootPath: Path(`(Trash)`),
    icon: Trash2Icon,
  }

  const predefinedCloudCategories: AnyCloudCategory[] = [
    cloudCategory,
    recentCategory,
    trashCategory,
  ]

  const { data: allUserGroupsRaw } = useSuspenseQuery(
    backendQueryOptions(remoteBackend, 'listUserGroups', []),
  )

  const allUserGroups =
    allUserGroupsRaw.length === 0 || !hasUserAndTeamSpaces ? null : allUserGroupsRaw

  const userSpace: UserCategory | null =
    hasUserAndTeamSpaces ?
      {
        type: 'user',
        id: userId,
        user: user,
        rootPath: Path(`enso://Users/${name}`),
        homeDirectoryId: userIdToDirectoryId(userId),
        label: getText('myFilesCategory'),
        icon: PersonIcon,
      }
    : null

  const doesHaveUserGroups =
    user.userGroups != null && user.userGroups.length > 0 && allUserGroups != null

  const userGroupDynamicCategories =
    doesHaveUserGroups ?
      user.userGroups.map<TeamCategory>((id) => {
        const group = allUserGroups.find((userGroup) => userGroup.id === id)

        invariant(
          group != null,
          `Unable to find user group by id: ${id}, allUserGroups: ${JSON.stringify(allUserGroups, null, 2)}`,
        )

        return {
          type: 'team',
          id,
          team: group,
          rootPath: Path(`enso://Teams/${group.groupName}`),
          homeDirectoryId: userGroupIdToDirectoryId(group.id),
          label: getText('teamCategory', group.groupName),
          icon: PeopleIcon,
        }
      })
    : null

  const categories = [
    ...predefinedCloudCategories,
    ...(userSpace != null ? [userSpace] : []),
    ...(userGroupDynamicCategories != null ? [...userGroupDynamicCategories] : []),
  ] as const

  const getCategoryById = useEventCallback(
    (id: CategoryId) => categories.find((category) => category.id === id) ?? null,
  )

  const getCategoriesByType = useEventCallback(
    <T extends Category['type']>(type: T) =>
      // This is safe, because we know that the result will have the correct type.
      // eslint-disable-next-line no-restricted-syntax
      categories.filter((category) => category.type === type) as CategoryByType<T>[],
  )

  const getCategoryByDirectoryId = useEventCallback(
    (directoryId: DirectoryId) =>
      categories.find((category) => {
        if ('homeDirectoryId' in category) {
          return category.homeDirectoryId === directoryId
        }

        return false
      }) ?? null,
  )

  return {
    categories,
    cloudCategory,
    recentCategory,
    trashCategory,
    userCategory: userSpace,
    teamCategories: userGroupDynamicCategories,
    getCategoryById,
    getCategoriesByType,
    isCloudCategory,
    getCategoryByDirectoryId,
  } as const
}

/**
 * Result of the useLocalCategoryList hook.
 */
export type LocalCategoryResult = ReturnType<typeof useLocalCategoryList>

/**
 * List of all categories in the LocalBackend.
 * Usually these are the root folder and the list of favorites
 */
export function useLocalCategoryList() {
  const { getText } = useText()
  const localBackend = useLocalBackend()

  const localCategory: LocalCategory = {
    type: 'local',
    id: 'local',
    label: getText('localCategory'),
    /** The root path of this category. */
    get rootPath() {
      return localBackend?.rootPath() ?? Path('')
    },
    icon: ComputerIcon,
  }

  const predefinedLocalCategories: AnyLocalCategory[] = [localCategory]

  const [localRootDirectories, setLocalRootDirectories] = useLocalStorageState(
    'localRootDirectories',
    [],
  )

  const localCategories = localRootDirectories.map<LocalDirectoryCategory>((directory) => ({
    type: 'local-directory',
    id: newDirectoryId(Path(directory)),
    rootPath: Path(directory),
    homeDirectoryId: newDirectoryId(Path(directory)),
    label: getFileName(directory),
    icon: FolderFilledIcon,
  }))

  const categories =
    localBackend == null ? [] : ([...predefinedLocalCategories, ...localCategories] as const)

  const addDirectory = useEventCallback((directory: string) => {
    setLocalRootDirectories([...localRootDirectories, directory])
  })

  const removeDirectory = useEventCallback((directory: DirectoryId) => {
    const category = getCategoryById(directory)

    if (category != null && category.type === 'local-directory') {
      setLocalRootDirectories(localRootDirectories.filter((d) => d !== category.rootPath))
    }
  })

  const getCategoryById = useEventCallback(
    (id: CategoryId) => categories.find((category) => category.id === id) ?? null,
  )

  const getCategoriesByType = useEventCallback(
    <T extends AnyLocalCategory['type']>(type: T) =>
      // This is safe, because we know that the result will have the correct type.
      // eslint-disable-next-line no-restricted-syntax
      categories.filter((category) => category.type === type) as CategoryByType<T>[],
  )

  if (localBackend == null) {
    return {
      // We don't have any categories if localBackend is not available.
      categories,
      localCategory: null,
      directories: null,
      // noop if localBackend is not available.
      addDirectory: () => {},
      // noop if localBackend is not available.
      removeDirectory: () => {},
      getCategoryById,
      getCategoriesByType,
      isLocalCategory,
    }
  }

  return {
    categories,
    localCategory,
    directories: localCategories,
    addDirectory,
    removeDirectory,
    getCategoryById,
    getCategoriesByType,
    isLocalCategory,
  } as const
}

/**
 * Result of the useCategories hook.
 */
export type CategoriesResult = ReturnType<typeof useCategories>

/**
 * List of all categories.
 */
export function useCategories() {
  const cloudCategories = useCloudCategoryList()
  const localCategories = useLocalCategoryList()

  const findCategoryById = useEventCallback((id: CategoryId) => {
    return cloudCategories.getCategoryById(id) ?? localCategories.getCategoryById(id)
  })

  return { cloudCategories, localCategories, findCategoryById }
}

/**
 * Context value for the categories.
 */
interface CategoriesContextValue {
  readonly cloudCategories: CloudCategoryResult
  readonly localCategories: LocalCategoryResult
  readonly category: Category
  readonly setCategory: (category: CategoryId) => void
  readonly resetCategory: () => void
  readonly associatedBackend: Backend
}

const CategoriesContext = createContext<CategoriesContextValue | null>(null)

/**
 * Props for the {@link CategoriesProvider}.
 */
export interface CategoriesProviderProps {
  readonly children: ReactNode | ((contextValue: CategoriesContextValue) => ReactNode)
  readonly onCategoryChange?: (previousCategory: Category | null, newCategory: Category) => void
}

/**
 * Provider for the categories.
 */
export function CategoriesProvider(props: CategoriesProviderProps): React.JSX.Element {
  const { children, onCategoryChange = () => {} } = props

  const { cloudCategories, localCategories, findCategoryById } = useCategories()
  const localBackend = useLocalBackend()
  const { isOffline } = useOffline()

  const [categoryId, privateSetCategoryId, resetCategoryId] = useSearchParamsState<CategoryId>(
    'driveCategory',
    () => {
      if (isOffline && localBackend != null) {
        return 'local'
      }

      return localBackend != null ? 'local' : 'cloud'
    },
    // This is safe, because we enshure the type inside the function
    // eslint-disable-next-line no-restricted-syntax
    (value): value is CategoryId => findCategoryById(value as CategoryId) != null,
  )

  const setCategoryId = useEventCallback((nextCategoryId: CategoryId) => {
    const previousCategory = findCategoryById(categoryId)
    privateSetCategoryId(nextCategoryId)
    // This is safe, because we know that the result will have the correct type.
    // eslint-disable-next-line no-restricted-syntax
    onCategoryChange(previousCategory, findCategoryById(nextCategoryId) as Category)
  })

  const category = findCategoryById(categoryId)

  // This is safe, because a category always specified
  // eslint-disable-next-line no-restricted-syntax
  const backend = useBackend(category as Category)

  // This usually doesn't happen but if so,
  // We reset the category to the default.
  if (category == null) {
    resetCategoryId(true)
    return <></>
  }

  const contextValue = {
    cloudCategories,
    localCategories,
    category,
    setCategory: setCategoryId,
    resetCategory: resetCategoryId,
    associatedBackend: backend,
  } satisfies CategoriesContextValue

  return (
    <CategoriesContext.Provider value={contextValue}>
      {typeof children === 'function' ? children(contextValue) : children}
    </CategoriesContext.Provider>
  )
}

/**
 * Gets the api to interact with the categories.
 */
export function useCategoriesAPI() {
  const context = useContext(CategoriesContext)

  invariant(context != null, 'useCategory must be used within a CategoriesProvider')

  return context
}
