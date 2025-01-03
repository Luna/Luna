/** @file Hooks for interacting with the backend. */
import { useId, useState } from 'react'

import {
  queryOptions,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
  type DefaultError,
  type Mutation,
  type MutationKey,
  type QueryKey,
  type UnusedSkipTokenOptions,
  type UseMutationOptions,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query'
import { toast } from 'react-toastify'
import invariant from 'tiny-invariant'

import {
  backendQueryOptions as backendQueryOptionsBase,
  type BackendMethods,
} from 'enso-common/src/backendQuery'

import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { useOpenProject } from '#/hooks/projectHooks'
import { useToastAndLog, useToastAndLogWithId } from '#/hooks/toastAndLogHooks'
import { CATEGORY_TO_FILTER_BY, type Category } from '#/layouts/CategorySwitcher/Category'
import DuplicateAssetsModal from '#/modals/DuplicateAssetsModal'
import { useFullUserSession } from '#/providers/AuthProvider'
import {
  useSetNewestFolderId,
  useSetSelectedAssets,
  useToggleDirectoryExpansion,
  type SelectedAssetInfo,
} from '#/providers/DriveProvider'
import { useLocalStorageState } from '#/providers/LocalStorageProvider'
import { useSetModal } from '#/providers/ModalProvider'
import { useText } from '#/providers/TextProvider'
import type Backend from '#/services/Backend'
import * as backendModule from '#/services/Backend'
import {
  AssetType,
  BackendType,
  type AnyAsset,
  type AssetId,
  type DirectoryAsset,
  type DirectoryId,
  type User,
  type UserGroupInfo,
} from '#/services/Backend'
import LocalBackend, { extractTypeAndId } from '#/services/LocalBackend'
import { TEAMS_DIRECTORY_ID, USERS_DIRECTORY_ID } from '#/services/remoteBackendPaths'
import { download } from '#/utilities/download'
import { getMessageOrToString } from '#/utilities/error'
import { tryCreateOwnerPermission } from '#/utilities/permissions'
import { usePreventNavigation } from '#/utilities/preventNavigation'
import { toRfc3339 } from 'enso-common/src/utilities/data/dateTime'

// The number of bytes in 1 megabyte.
const MB_BYTES = 1_000_000
const S3_CHUNK_SIZE_MB = Math.round(backendModule.S3_CHUNK_SIZE_BYTES / MB_BYTES)

/** Ensure that the given type contains only names of backend methods. */
type DefineBackendMethods<T extends keyof Backend> = T

/** Names of methods corresponding to mutations. */
export type BackendMutationMethod = DefineBackendMethods<
  | 'acceptInvitation'
  | 'associateTag'
  | 'changeUserGroup'
  | 'closeProject'
  | 'copyAsset'
  | 'createCheckoutSession'
  | 'createDatalink'
  | 'createDirectory'
  | 'createPermission'
  | 'createProject'
  | 'createSecret'
  | 'createTag'
  | 'createUser'
  | 'createUserGroup'
  | 'declineInvitation'
  | 'deleteAsset'
  | 'deleteDatalink'
  | 'deleteInvitation'
  | 'deleteTag'
  | 'deleteUser'
  | 'deleteUserGroup'
  | 'duplicateProject'
  | 'inviteUser'
  | 'logEvent'
  | 'openProject'
  | 'removeUser'
  | 'resendInvitation'
  | 'restoreUser'
  | 'undoDeleteAsset'
  | 'updateAsset'
  | 'updateDirectory'
  | 'updateFile'
  | 'updateOrganization'
  | 'updateProject'
  | 'updateSecret'
  | 'updateUser'
  | 'uploadFileChunk'
  | 'uploadFileEnd'
  | 'uploadFileStart'
  | 'uploadOrganizationPicture'
  | 'uploadUserPicture'
>

/** Names of methods corresponding to queries. */
export type BackendQueryMethod = Exclude<BackendMethods, BackendMutationMethod>

/** An identity function to help in constructing options for a mutation. */
function mutationOptions<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
): UseMutationOptions<TData, TError, TVariables, TContext> {
  return options
}

export function backendQueryOptions<Method extends BackendQueryMethod>(
  backend: Backend,
  method: Method,
  args: Readonly<Parameters<Backend[Method]>>,
  options?: Omit<UseQueryOptions<Awaited<ReturnType<Backend[Method]>>>, 'queryFn' | 'queryKey'> &
    Partial<Pick<UseQueryOptions<Awaited<ReturnType<Backend[Method]>>>, 'queryKey'>>,
): UnusedSkipTokenOptions<
  Awaited<ReturnType<Backend[Method]>>,
  Error,
  Awaited<ReturnType<Backend[Method]>>,
  QueryKey
>
export function backendQueryOptions<Method extends BackendQueryMethod>(
  backend: Backend | null,
  method: Method,
  args: Readonly<Parameters<Backend[Method]>>,
  options?: Omit<UseQueryOptions<Awaited<ReturnType<Backend[Method]>>>, 'queryFn' | 'queryKey'> &
    Partial<Pick<UseQueryOptions<Awaited<ReturnType<Backend[Method]>>>, 'queryKey'>>,
): UnusedSkipTokenOptions<
  Awaited<ReturnType<Backend[Method]> | undefined>,
  Error,
  Awaited<ReturnType<Backend[Method]> | undefined>,
  QueryKey
>
/** Wrap a backend method call in a React Query. */
export function backendQueryOptions<Method extends BackendQueryMethod>(
  backend: Backend | null,
  method: Method,
  args: Readonly<Parameters<Backend[Method]>>,
  options?: Omit<UseQueryOptions<Awaited<ReturnType<Backend[Method]>>>, 'queryFn' | 'queryKey'> &
    Partial<Pick<UseQueryOptions<Awaited<ReturnType<Backend[Method]>>>, 'queryKey'>>,
) {
  return queryOptions<Awaited<ReturnType<Backend[Method]>>>({
    ...options,
    ...backendQueryOptionsBase(backend, method, args, options?.queryKey),
    // eslint-disable-next-line no-restricted-syntax, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
    queryFn: () => (backend?.[method] as any)?.(...args),
  })
}

export function useBackendQuery<Method extends BackendQueryMethod>(
  backend: Backend,
  method: Method,
  args: Readonly<Parameters<Backend[Method]>>,
  options?: Omit<UseQueryOptions<Awaited<ReturnType<Backend[Method]>>>, 'queryFn' | 'queryKey'> &
    Partial<Pick<UseQueryOptions<Awaited<ReturnType<Backend[Method]>>>, 'queryKey'>>,
): UseQueryResult<Awaited<ReturnType<Backend[Method]>>>
export function useBackendQuery<Method extends BackendQueryMethod>(
  backend: Backend | null,
  method: Method,
  args: Readonly<Parameters<Backend[Method]>>,
  options?: Omit<UseQueryOptions<Awaited<ReturnType<Backend[Method]>>>, 'queryFn' | 'queryKey'> &
    Partial<Pick<UseQueryOptions<Awaited<ReturnType<Backend[Method]>>>, 'queryKey'>>,
): UseQueryResult<Awaited<ReturnType<Backend[Method]>> | undefined>
/** Wrap a backend method call in a React Query. */
export function useBackendQuery<Method extends BackendQueryMethod>(
  backend: Backend | null,
  method: Method,
  args: Readonly<Parameters<Backend[Method]>>,
  options?: Omit<UseQueryOptions<Awaited<ReturnType<Backend[Method]>>>, 'queryFn' | 'queryKey'> &
    Partial<Pick<UseQueryOptions<Awaited<ReturnType<Backend[Method]>>>, 'queryKey'>>,
) {
  return useQuery(backendQueryOptions(backend, method, args, options))
}

const INVALIDATE_ALL_QUERIES = Symbol('invalidate all queries')
const INVALIDATION_MAP: Partial<
  Record<BackendMutationMethod, readonly (BackendQueryMethod | typeof INVALIDATE_ALL_QUERIES)[]>
> = {
  createUser: ['usersMe'],
  updateUser: ['usersMe'],
  deleteUser: ['usersMe'],
  restoreUser: ['usersMe'],
  uploadUserPicture: ['usersMe'],
  updateOrganization: ['getOrganization'],
  uploadOrganizationPicture: ['getOrganization'],
  createUserGroup: ['listUserGroups'],
  deleteUserGroup: ['listUserGroups'],
  changeUserGroup: ['listUsers'],
  createTag: ['listTags'],
  deleteTag: ['listTags'],
  associateTag: ['listDirectory'],
  acceptInvitation: [INVALIDATE_ALL_QUERIES],
  declineInvitation: ['usersMe'],
  createProject: ['listDirectory'],
  duplicateProject: ['listDirectory'],
  createDirectory: ['listDirectory'],
  createSecret: ['listDirectory'],
  updateSecret: ['listDirectory'],
  updateProject: ['listDirectory'],
  updateFile: ['listDirectory'],
  updateDirectory: ['listDirectory'],
  createDatalink: ['listDirectory', 'getDatalink'],
  uploadFileEnd: ['listDirectory'],
  copyAsset: ['listDirectory', 'listAssetVersions'],
  deleteAsset: ['listDirectory', 'listAssetVersions'],
  undoDeleteAsset: ['listDirectory'],
  updateAsset: ['listDirectory', 'listAssetVersions'],
  openProject: ['listDirectory'],
  closeProject: ['listDirectory', 'listAssetVersions'],
}

/** The type of the corresponding mutation for the given backend method. */
export type BackendMutation<Method extends BackendMutationMethod> = Mutation<
  Awaited<ReturnType<Backend[Method]>>,
  Error,
  Parameters<Backend[Method]>
>

export function backendMutationOptions<Method extends BackendMutationMethod>(
  backend: Backend,
  method: Method,
  options?: Omit<
    UseMutationOptions<Awaited<ReturnType<Backend[Method]>>, Error, Parameters<Backend[Method]>>,
    'mutationFn'
  >,
): UseMutationOptions<Awaited<ReturnType<Backend[Method]>>, Error, Parameters<Backend[Method]>>
export function backendMutationOptions<Method extends BackendMutationMethod>(
  backend: Backend | null,
  method: Method,
  options?: Omit<
    UseMutationOptions<Awaited<ReturnType<Backend[Method]>>, Error, Parameters<Backend[Method]>>,
    'mutationFn'
  >,
): UseMutationOptions<
  Awaited<ReturnType<Backend[Method]>> | undefined,
  Error,
  Parameters<Backend[Method]>
>
/** Wrap a backend method call in a React Query Mutation. */
export function backendMutationOptions<Method extends BackendMutationMethod>(
  backend: Backend | null,
  method: Method,
  options?: Omit<
    UseMutationOptions<Awaited<ReturnType<Backend[Method]>>, Error, Parameters<Backend[Method]>>,
    'mutationFn'
  > & { readonly invalidate?: boolean },
): UseMutationOptions<Awaited<ReturnType<Backend[Method]>>, Error, Parameters<Backend[Method]>> {
  return {
    ...options,
    mutationKey: [backend?.type, method, ...(options?.mutationKey ?? [])],
    // eslint-disable-next-line no-restricted-syntax, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
    mutationFn: (args) => (backend?.[method] as any)?.(...args),
    networkMode: backend?.type === BackendType.local ? 'always' : 'online',
    meta: {
      invalidates:
        options?.invalidate === false ?
          []
        : [
            ...(options?.meta?.invalidates ?? []),
            ...(INVALIDATION_MAP[method]?.map((queryMethod) =>
              queryMethod === INVALIDATE_ALL_QUERIES ?
                [backend?.type]
              : [backend?.type, queryMethod],
            ) ?? []),
          ],
      awaitInvalidates: options?.meta?.awaitInvalidates ?? true,
    },
  }
}

/** A user group, as well as the users that are a part of the user group. */
export interface UserGroupInfoWithUsers extends UserGroupInfo {
  readonly users: readonly User[]
}

/** A list of user groups, taking into account optimistic state. */
export function useListUserGroupsWithUsers(
  backend: Backend,
): readonly UserGroupInfoWithUsers[] | null {
  const listUserGroupsQuery = useBackendQuery(backend, 'listUserGroups', [])
  const listUsersQuery = useBackendQuery(backend, 'listUsers', [])
  if (listUserGroupsQuery.data == null || listUsersQuery.data == null) {
    return null
  } else {
    const result = listUserGroupsQuery.data.map((userGroup) => {
      const usersInGroup: readonly User[] = listUsersQuery.data.filter((user) =>
        user.userGroups?.includes(userGroup.id),
      )
      return { ...userGroup, users: usersInGroup }
    })
    return result
  }
}

/** Options for {@link listDirectoryQueryOptions}. */
export interface ListDirectoryQueryOptions {
  readonly backend: Backend
  readonly parentId: DirectoryId
  readonly category: Category
}

/** Build a query options object to fetch the children of a directory. */
export function listDirectoryQueryOptions(options: ListDirectoryQueryOptions) {
  const { backend, parentId, category } = options

  return queryOptions({
    queryKey: [
      backend.type,
      'listDirectory',
      parentId,
      {
        labels: null,
        filterBy: CATEGORY_TO_FILTER_BY[category.type],
        recentProjects: category.type === 'recent',
      },
    ] as const,
    // Setting stale time to `Infinity` avoids attaching a ton of
    // setTimeouts to the query. Improves performance.
    // This is fine as refetching is handled by another query.
    staleTime: Infinity,
    queryFn: async () => {
      try {
        const result = await backend.listDirectory(
          {
            parentId,
            filterBy: CATEGORY_TO_FILTER_BY[category.type],
            labels: null,
            recentProjects: category.type === 'recent',
          },
          parentId,
        )
        return result
      } catch (e) {
        if (e instanceof Error) {
          throw Object.assign(e, { parentId })
        } else {
          throw e
        }
      }
    },
  })
}

/** The type of directory listings in the React Query cache. */
type DirectoryQuery = readonly AnyAsset<AssetType>[] | undefined

/** Options for {@link useAsset}. */
export interface UseAssetOptions extends ListDirectoryQueryOptions {
  readonly assetId: AssetId
}

/** Data for a specific asset. */
export function useAsset(options: UseAssetOptions) {
  const { parentId, assetId } = options

  const { data: asset } = useQuery({
    ...listDirectoryQueryOptions(options),
    select: (data) => data.find((child) => child.id === assetId),
  })

  if (asset) {
    return asset
  }

  const shared = {
    parentId,
    projectState: null,
    extension: null,
    description: '',
    modifiedAt: toRfc3339(new Date()),
    permissions: [],
    labels: [],
    parentsPath: '',
    virtualParentsPath: '',
  }
  switch (true) {
    case assetId === USERS_DIRECTORY_ID: {
      return {
        ...shared,
        id: assetId,
        title: 'Users',
        type: AssetType.directory,
      } satisfies DirectoryAsset
    }
    case assetId === TEAMS_DIRECTORY_ID: {
      return {
        ...shared,
        id: assetId,
        title: 'Teams',
        type: AssetType.directory,
      } satisfies DirectoryAsset
    }
    case backendModule.isLoadingAssetId(assetId): {
      return {
        ...shared,
        id: assetId,
        title: '',
        type: AssetType.specialLoading,
      } satisfies backendModule.SpecialLoadingAsset
    }
    case backendModule.isEmptyAssetId(assetId): {
      return {
        ...shared,
        id: assetId,
        title: '',
        type: AssetType.specialEmpty,
      } satisfies backendModule.SpecialEmptyAsset
    }
    case backendModule.isErrorAssetId(assetId): {
      return {
        ...shared,
        id: assetId,
        title: '',
        type: AssetType.specialError,
      } satisfies backendModule.SpecialErrorAsset
    }
    default: {
      return
    }
  }
}

/** Non-nullable for a specific asset. */
export function useAssetStrict(options: UseAssetOptions) {
  const asset = useAsset(options)

  invariant(
    asset,
    `Expected asset to be defined, but got undefined, Asset ID: ${JSON.stringify(options.assetId)}`,
  )

  return asset
}

/** Return matching in-flight mutations matching the given filters. */
export function useBackendMutationState<Method extends BackendMutationMethod, Result>(
  backend: Backend,
  method: Method,
  options: {
    mutationKey?: MutationKey
    predicate?: (mutation: BackendMutation<Method>) => boolean
    select?: (mutation: BackendMutation<Method>) => Result
  } = {},
) {
  const { mutationKey, predicate, select } = options
  return useMutationState({
    filters: {
      ...backendMutationOptions(backend, method, mutationKey ? { mutationKey } : {}),
      predicate: (mutation: BackendMutation<Method>) =>
        mutation.state.status === 'pending' && (predicate?.(mutation) ?? true),
    },
    // This is UNSAFE when the `Result` parameter is explicitly specified in the
    // generic parameter list.
    // eslint-disable-next-line no-restricted-syntax
    select: select as (mutation: Mutation<unknown, Error, unknown, unknown>) => Result,
  })
}

/** Get the root directory ID given the current backend and category. */
export function useRootDirectoryId(backend: Backend, category: Category) {
  const { user } = useFullUserSession()
  const { data: organization } = useSuspenseQuery({
    queryKey: [backend.type, 'getOrganization'],
    queryFn: () => backend.getOrganization(),
  })
  const [localRootDirectory] = useLocalStorageState('localRootDirectory')

  const localRootPath = localRootDirectory != null ? backendModule.Path(localRootDirectory) : null
  const id =
    'homeDirectoryId' in category ?
      category.homeDirectoryId
    : backend.rootDirectoryId(user, organization, localRootPath)
  invariant(id, 'Missing root directory')
  return id
}

/** Return query data for the children of a directory, fetching it if it does not exist. */
function useEnsureListDirectory(backend: Backend, category: Category) {
  const queryClient = useQueryClient()
  return useEventCallback(async (parentId: DirectoryId) => {
    return await queryClient.ensureQueryData(
      backendQueryOptions(backend, 'listDirectory', [
        {
          parentId,
          labels: null,
          filterBy: CATEGORY_TO_FILTER_BY[category.type],
          recentProjects: category.type === 'recent',
        },
        '(unknown)',
      ]),
    )
  })
}

/**
 * Remove an asset from the React Query cache. Should only be called on
 * optimistically inserted assets.
 */
function useDeleteAsset(backend: Backend, category: Category) {
  const queryClient = useQueryClient()
  const ensureListDirectory = useEnsureListDirectory(backend, category)

  return useEventCallback(async (assetId: AssetId, parentId: DirectoryId) => {
    const siblings = await ensureListDirectory(parentId)
    const asset = siblings.find((sibling) => sibling.id === assetId)
    if (!asset) return

    const listDirectoryQuery = queryClient.getQueryCache().find<DirectoryQuery>({
      queryKey: [
        backend.type,
        'listDirectory',
        parentId,
        {
          labels: null,
          filterBy: CATEGORY_TO_FILTER_BY[category.type],
          recentProjects: category.type === 'recent',
        },
      ],
    })

    if (listDirectoryQuery?.state.data) {
      listDirectoryQuery.setData(
        listDirectoryQuery.state.data.filter((child) => child.id !== assetId),
      )
    }
  })
}

/** A function to create a new folder. */
export function useNewFolder(backend: Backend, category: Category) {
  const ensureListDirectory = useEnsureListDirectory(backend, category)
  const toggleDirectoryExpansion = useToggleDirectoryExpansion()
  const setNewestFolderId = useSetNewestFolderId()
  const setSelectedAssets = useSetSelectedAssets()
  const { user } = useFullUserSession()
  const { data: users } = useBackendQuery(backend, 'listUsers', [])
  const { data: userGroups } = useBackendQuery(backend, 'listUserGroups', [])
  const createDirectoryMutation = useMutation(backendMutationOptions(backend, 'createDirectory'))

  return useEventCallback(async (parentId: DirectoryId, parentPath: string | null | undefined) => {
    toggleDirectoryExpansion(parentId, true)
    const siblings = await ensureListDirectory(parentId)
    const directoryIndices = siblings
      .filter(backendModule.assetIsDirectory)
      .map((item) => /^New Folder (?<directoryIndex>\d+)$/.exec(item.title))
      .map((match) => match?.groups?.directoryIndex)
      .map((maybeIndex) => (maybeIndex != null ? parseInt(maybeIndex, 10) : 0))
    const title = `New Folder ${Math.max(0, ...directoryIndices) + 1}`
    const placeholderItem = backendModule.createPlaceholderDirectoryAsset(
      title,
      parentId,
      tryCreateOwnerPermission(
        `${parentPath ?? ''}/${title}`,
        category,
        user,
        users ?? [],
        userGroups ?? [],
      ),
    )

    return await createDirectoryMutation
      .mutateAsync([{ parentId: placeholderItem.parentId, title: placeholderItem.title }])
      .then((result) => {
        setNewestFolderId(result.id)
        setSelectedAssets([{ type: AssetType.directory, ...result }])
        return result
      })
  })
}

/** A function to create a new project. */
export function useNewProject(backend: Backend, category: Category) {
  const ensureListDirectory = useEnsureListDirectory(backend, category)
  const toastAndLog = useToastAndLog()
  const doOpenProject = useOpenProject()
  const deleteAsset = useDeleteAsset(backend, category)
  const toggleDirectoryExpansion = useToggleDirectoryExpansion()

  const { user } = useFullUserSession()
  const { data: users } = useBackendQuery(backend, 'listUsers', [])
  const { data: userGroups } = useBackendQuery(backend, 'listUserGroups', [])
  const createProjectMutation = useMutation(backendMutationOptions(backend, 'createProject'))

  return useEventCallback(
    async (
      {
        templateName,
        templateId,
        datalinkId,
      }: {
        templateName: string | null | undefined
        templateId?: string | null | undefined
        datalinkId?: backendModule.DatalinkId | null | undefined
      },
      parentId: DirectoryId,
      parentPath: string | null | undefined,
    ) => {
      toggleDirectoryExpansion(parentId, true)

      const siblings = await ensureListDirectory(parentId)
      const projectName = (() => {
        const prefix = `${templateName ?? 'New Project'} `
        const projectNameTemplate = new RegExp(`^${prefix}(?<projectIndex>\\d+)$`)
        const projectIndices = siblings
          .filter(backendModule.assetIsProject)
          .map((item) => projectNameTemplate.exec(item.title)?.groups?.projectIndex)
          .map((maybeIndex) => (maybeIndex != null ? parseInt(maybeIndex, 10) : 0))
        return `${prefix}${Math.max(0, ...projectIndices) + 1}`
      })()

      const path = backend instanceof LocalBackend ? backend.joinPath(parentId, projectName) : null

      const placeholderItem = backendModule.createPlaceholderProjectAsset(
        projectName,
        parentId,
        tryCreateOwnerPermission(
          `${parentPath ?? ''}/${projectName}`,
          category,
          user,
          users ?? [],
          userGroups ?? [],
        ),
        user,
        path,
      )

      return await createProjectMutation
        .mutateAsync([
          {
            parentDirectoryId: placeholderItem.parentId,
            projectName: placeholderItem.title,
            ...(templateId == null ? {} : { projectTemplateName: templateId }),
            ...(datalinkId == null ? {} : { datalinkId: datalinkId }),
          },
        ])
        .catch((error) => {
          void deleteAsset(placeholderItem.id, parentId)
          toastAndLog('createProjectError', error)
          throw error
        })
        .then((createdProject) => {
          doOpenProject({
            id: createdProject.projectId,
            type: backend.type,
            parentId: placeholderItem.parentId,
            title: createdProject.name,
          })

          return createdProject
        })
    },
  )
}

/** A function to create a new secret. */
export function useNewSecret(backend: Backend, category: Category) {
  const toggleDirectoryExpansion = useToggleDirectoryExpansion()
  const { user } = useFullUserSession()
  const { data: users } = useBackendQuery(backend, 'listUsers', [])
  const { data: userGroups } = useBackendQuery(backend, 'listUserGroups', [])
  const createSecretMutation = useMutation(backendMutationOptions(backend, 'createSecret'))

  return useEventCallback(
    async (
      name: string,
      value: string,
      parentId: DirectoryId,
      parentPath: string | null | undefined,
    ) => {
      toggleDirectoryExpansion(parentId, true)
      const placeholderItem = backendModule.createPlaceholderSecretAsset(
        name,
        parentId,
        tryCreateOwnerPermission(
          `${parentPath ?? ''}/${name}`,
          category,
          user,
          users ?? [],
          userGroups ?? [],
        ),
      )

      return await createSecretMutation.mutateAsync([
        {
          parentDirectoryId: placeholderItem.parentId,
          name: placeholderItem.title,
          value: value,
        },
      ])
    },
  )
}

/** A function to create a new Datalink. */
export function useNewDatalink(backend: Backend, category: Category) {
  const toggleDirectoryExpansion = useToggleDirectoryExpansion()
  const { user } = useFullUserSession()
  const { data: users } = useBackendQuery(backend, 'listUsers', [])
  const { data: userGroups } = useBackendQuery(backend, 'listUserGroups', [])
  const createDatalinkMutation = useMutation(backendMutationOptions(backend, 'createDatalink'))

  return useEventCallback(
    async (
      name: string,
      value: unknown,
      parentId: DirectoryId,
      parentPath: string | null | undefined,
    ) => {
      toggleDirectoryExpansion(parentId, true)
      const placeholderItem = backendModule.createPlaceholderDatalinkAsset(
        name,
        parentId,
        tryCreateOwnerPermission(
          `${parentPath ?? ''}/${name}`,
          category,
          user,
          users ?? [],
          userGroups ?? [],
        ),
      )

      return await createDatalinkMutation.mutateAsync([
        {
          parentDirectoryId: placeholderItem.parentId,
          datalinkId: null,
          name: placeholderItem.title,
          value,
        },
      ])
    },
  )
}

/** A function to upload files. */
export function useUploadFiles(backend: Backend, category: Category) {
  const ensureListDirectory = useEnsureListDirectory(backend, category)
  const toastAndLog = useToastAndLog()
  const toggleDirectoryExpansion = useToggleDirectoryExpansion()
  const { setModal } = useSetModal()
  const { user } = useFullUserSession()
  const { data: users } = useBackendQuery(backend, 'listUsers', [])
  const { data: userGroups } = useBackendQuery(backend, 'listUserGroups', [])
  const uploadFileMutation = useUploadFileWithToastMutation(backend)
  const setSelectedAssets = useSetSelectedAssets()

  return useEventCallback(
    async (
      filesToUpload: readonly File[],
      parentId: DirectoryId,
      parentPath: string | null | undefined,
    ) => {
      const localBackend = backend instanceof LocalBackend ? backend : null
      const reversedFiles = Array.from(filesToUpload).reverse()
      const siblings = await ensureListDirectory(parentId)
      const siblingFiles = siblings.filter(backendModule.assetIsFile)
      const siblingProjects = siblings.filter(backendModule.assetIsProject)
      const siblingFileTitles = new Set(siblingFiles.map((asset) => asset.title))
      const siblingProjectTitles = new Set(siblingProjects.map((asset) => asset.title))
      const ownerPermission = tryCreateOwnerPermission(
        parentPath ?? '',
        category,
        user,
        users ?? [],
        userGroups ?? [],
      )
      const files = reversedFiles.filter(backendModule.fileIsNotProject).map((file) => {
        const asset = backendModule.createPlaceholderFileAsset(
          backendModule.escapeSpecialCharacters(file.name),
          parentId,
          ownerPermission,
        )
        return { asset, file }
      })
      const projects = reversedFiles.filter(backendModule.fileIsProject).map((file) => {
        const basename = backendModule.escapeSpecialCharacters(
          backendModule.stripProjectExtension(file.name),
        )
        const asset = backendModule.createPlaceholderProjectAsset(
          basename,
          parentId,
          ownerPermission,
          user,
          localBackend?.joinPath(parentId, basename) ?? null,
        )
        return { asset, file }
      })
      const duplicateFiles = files.filter((file) => siblingFileTitles.has(file.asset.title))
      const duplicateProjects = projects.filter((project) =>
        siblingProjectTitles.has(backendModule.stripProjectExtension(project.asset.title)),
      )
      const fileMap = new Map<AssetId, File>([
        ...files.map(({ asset, file }) => [asset.id, file] as const),
        ...projects.map(({ asset, file }) => [asset.id, file] as const),
      ])
      const uploadedFileInfos: SelectedAssetInfo[] = []
      const addToSelection = (info: SelectedAssetInfo) => {
        uploadedFileInfos.push(info)
        setSelectedAssets(uploadedFileInfos)
      }

      const doUploadFile = async (asset: AnyAsset, method: 'new' | 'update') => {
        const file = fileMap.get(asset.id)

        if (file != null) {
          const fileId = method === 'new' ? null : asset.id

          switch (true) {
            case backendModule.assetIsProject(asset): {
              const { extension } = backendModule.extractProjectExtension(file.name)
              const title = backendModule.escapeSpecialCharacters(
                backendModule.stripProjectExtension(asset.title),
              )

              await uploadFileMutation
                .mutateAsync(
                  {
                    fileId,
                    fileName: `${title}.${extension}`,
                    parentDirectoryId: asset.parentId,
                  },
                  file,
                )
                .then(({ id }) => {
                  addToSelection({
                    type: AssetType.project,
                    // This is SAFE, because it is guarded behind `assetIsProject`.
                    // eslint-disable-next-line no-restricted-syntax
                    id: id as backendModule.ProjectId,
                    parentId: asset.parentId,
                    title,
                  })
                })
                .catch((error) => {
                  toastAndLog('uploadProjectError', error)
                })

              break
            }
            case backendModule.assetIsFile(asset): {
              const title = backendModule.escapeSpecialCharacters(asset.title)
              await uploadFileMutation
                .mutateAsync({ fileId, fileName: title, parentDirectoryId: asset.parentId }, file)
                .then(({ id }) => {
                  addToSelection({
                    type: AssetType.file,
                    // This is SAFE, because it is guarded behind `assetIsFile`.
                    // eslint-disable-next-line no-restricted-syntax
                    id: id as backendModule.FileId,
                    parentId: asset.parentId,
                    title,
                  })
                })

              break
            }
            default:
              break
          }
        }
      }

      if (duplicateFiles.length === 0 && duplicateProjects.length === 0) {
        toggleDirectoryExpansion(parentId, true)
        const assets = [...files, ...projects].map(({ asset }) => asset)
        void Promise.all(assets.map((asset) => doUploadFile(asset, 'new')))
      } else {
        const siblingFilesByName = new Map(siblingFiles.map((file) => [file.title, file]))
        const siblingProjectsByName = new Map(
          siblingProjects.map((project) => [project.title, project]),
        )
        const conflictingFiles = duplicateFiles.map((file) => ({
          // This is SAFE, as `duplicateFiles` only contains files that have siblings
          // with the same name.
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          current: siblingFilesByName.get(file.asset.title)!,
          new: backendModule.createPlaceholderFileAsset(
            file.asset.title,
            parentId,
            ownerPermission,
          ),
          file: file.file,
        }))
        const conflictingProjects = duplicateProjects.map((project) => {
          const basename = backendModule.stripProjectExtension(project.asset.title)
          return {
            // This is SAFE, as `duplicateProjects` only contains projects that have
            // siblings with the same name.
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            current: siblingProjectsByName.get(basename)!,
            new: backendModule.createPlaceholderProjectAsset(
              basename,
              parentId,
              ownerPermission,
              user,
              localBackend?.joinPath(parentId, basename) ?? null,
            ),
            file: project.file,
          }
        })
        setModal(
          <DuplicateAssetsModal
            parentKey={parentId}
            parentId={parentId}
            conflictingFiles={conflictingFiles}
            conflictingProjects={conflictingProjects}
            siblingFileNames={siblingFilesByName.keys()}
            siblingProjectNames={siblingProjectsByName.keys()}
            nonConflictingFileCount={files.length - conflictingFiles.length}
            nonConflictingProjectCount={projects.length - conflictingProjects.length}
            doUpdateConflicting={async (resolvedConflicts) => {
              toggleDirectoryExpansion(parentId, true)

              await Promise.allSettled(
                resolvedConflicts.map((conflict) => {
                  const isUpdating = conflict.current.title === conflict.new.title
                  const asset = isUpdating ? conflict.current : conflict.new
                  fileMap.set(asset.id, conflict.file)
                  return doUploadFile(asset, isUpdating ? 'update' : 'new')
                }),
              )
            }}
            doUploadNonConflicting={async () => {
              toggleDirectoryExpansion(parentId, true)

              const newFiles = files
                .filter((file) => !siblingFileTitles.has(file.asset.title))
                .map((file) => {
                  const asset = backendModule.createPlaceholderFileAsset(
                    file.asset.title,
                    parentId,
                    ownerPermission,
                  )
                  fileMap.set(asset.id, file.file)
                  return asset
                })

              const newProjects = projects
                .filter(
                  (project) =>
                    !siblingProjectTitles.has(
                      backendModule.stripProjectExtension(project.asset.title),
                    ),
                )
                .map((project) => {
                  const basename = backendModule.stripProjectExtension(project.asset.title)
                  const asset = backendModule.createPlaceholderProjectAsset(
                    basename,
                    parentId,
                    ownerPermission,
                    user,
                    localBackend?.joinPath(parentId, basename) ?? null,
                  )
                  fileMap.set(asset.id, project.file)
                  return asset
                })

              const assets = [...newFiles, ...newProjects]

              await Promise.allSettled(assets.map((asset) => doUploadFile(asset, 'new')))
            }}
          />,
        )
      }
    },
  )
}

/** Upload progress for {@link useUploadFileMutation}. */
export interface UploadFileMutationProgress {
  /**
   * Whether this is the first progress update.
   * Useful to determine whether to create a new toast or to update an existing toast.
   */
  readonly event: 'begin' | 'chunk' | 'end'
  readonly sentMb: number
  readonly totalMb: number
}

/** Options for {@link useUploadFileMutation}. */
export interface UploadFileMutationOptions {
  /**
   * Defaults to 3.
   * Controls the default value of {@link UploadFileMutationOptions['chunkRetries']}
   * and {@link UploadFileMutationOptions['endRetries']}.
   */
  readonly retries?: number
  /** Defaults to {@link UploadFileMutationOptions['retries']}. */
  readonly chunkRetries?: number
  /** Defaults to {@link UploadFileMutationOptions['retries']}. */
  readonly endRetries?: number
  /** Called for all progress updates (`onBegin`, `onChunkSuccess` and `onSuccess`). */
  readonly onProgress?: (progress: UploadFileMutationProgress) => void
  /** Called before any mutations are sent. */
  readonly onBegin?: (progress: UploadFileMutationProgress) => void
  /** Called after each successful chunk upload mutation. */
  readonly onChunkSuccess?: (progress: UploadFileMutationProgress) => void
  /** Called after the entire mutation succeeds. */
  readonly onSuccess?: (progress: UploadFileMutationProgress) => void
  /** Called after any mutations fail. */
  readonly onError?: (error: unknown) => void
  /** Called after `onSuccess` or `onError`, depending on whether the mutation succeeded. */
  readonly onSettled?: (progress: UploadFileMutationProgress | null, error: unknown) => void
}

/**
 * Call "upload file" mutations for a file.
 * Always uses multipart upload for Cloud backend.
 * Shows toasts to update progress.
 */
export function useUploadFileWithToastMutation(
  backend: Backend,
  options: UploadFileMutationOptions = {},
) {
  const toastId = useId()
  const { getText } = useText()
  const toastAndLog = useToastAndLogWithId()
  const { onBegin, onChunkSuccess, onSuccess, onError } = options

  const mutation = useUploadFileMutation(backend, {
    ...options,
    onBegin: (progress) => {
      onBegin?.(progress)
      const { sentMb, totalMb } = progress
      toast.loading(getText('uploadLargeFileStatus', sentMb, totalMb), {
        toastId,
        position: 'bottom-right',
      })
    },
    onChunkSuccess: (progress) => {
      onChunkSuccess?.(progress)
      const { sentMb, totalMb } = progress
      const text = getText('uploadLargeFileStatus', sentMb, totalMb)
      toast.update(toastId, { render: text })
    },
    onSuccess: (progress) => {
      onSuccess?.(progress)
      toast.update(toastId, {
        type: 'success',
        render: getText('uploadLargeFileSuccess'),
        isLoading: false,
        autoClose: null,
      })
    },
    onError: (error) => {
      onError?.(error)
      toastAndLog(toastId, 'uploadLargeFileError', error)
    },
  })

  usePreventNavigation({ message: getText('anUploadIsInProgress'), isEnabled: mutation.isPending })

  return mutation
}

/**
 * Call "upload file" mutations for a file.
 * Always uses multipart upload for Cloud backend.
 */
export function useUploadFileMutation(backend: Backend, options: UploadFileMutationOptions = {}) {
  const toastAndLog = useToastAndLog()
  const {
    retries = 3,
    chunkRetries = retries,
    endRetries = retries,
    onError = (error) => {
      toastAndLog('uploadLargeFileError', error)
    },
  } = options
  const uploadFileStartMutation = useMutation(backendMutationOptions(backend, 'uploadFileStart'))
  const uploadFileChunkMutation = useMutation(
    backendMutationOptions(backend, 'uploadFileChunk', {
      retry: chunkRetries,
    }),
  )
  const uploadFileEndMutation = useMutation(
    backendMutationOptions(backend, 'uploadFileEnd', { retry: endRetries }),
  )
  const [variables, setVariables] =
    useState<[params: backendModule.UploadFileRequestParams, file: File]>()
  const [sentMb, setSentMb] = useState(0)
  const [totalMb, setTotalMb] = useState(0)
  const mutateAsync = useEventCallback(
    async (body: backendModule.UploadFileRequestParams, file: File) => {
      setVariables([body, file])
      const fileSizeMb = Math.ceil(file.size / MB_BYTES)
      options.onBegin?.({ event: 'begin', sentMb: 0, totalMb: fileSizeMb })
      setSentMb(0)
      setTotalMb(fileSizeMb)
      try {
        const { sourcePath, uploadId, presignedUrls } = await uploadFileStartMutation.mutateAsync([
          body,
          file,
        ])
        const parts: backendModule.S3MultipartPart[] = []
        for (const [url, i] of Array.from(
          presignedUrls,
          (presignedUrl, index) => [presignedUrl, index] as const,
        )) {
          parts.push(await uploadFileChunkMutation.mutateAsync([url, file, i]))
          const newSentMb = Math.min((i + 1) * S3_CHUNK_SIZE_MB, fileSizeMb)
          setSentMb(newSentMb)
          options.onChunkSuccess?.({
            event: 'chunk',
            sentMb: newSentMb,
            totalMb: fileSizeMb,
          })
        }
        const result = await uploadFileEndMutation.mutateAsync([
          {
            parentDirectoryId: body.parentDirectoryId,
            parts,
            sourcePath: sourcePath,
            uploadId: uploadId,
            assetId: body.fileId,
            fileName: body.fileName,
          },
        ])
        setSentMb(fileSizeMb)
        const progress: UploadFileMutationProgress = {
          event: 'end',
          sentMb: fileSizeMb,
          totalMb: fileSizeMb,
        }
        options.onSuccess?.(progress)
        options.onSettled?.(progress, null)
        return result
      } catch (error) {
        onError(error)
        options.onSettled?.(null, error)
        throw error
      }
    },
  )
  const mutate = useEventCallback((params: backendModule.UploadFileRequestParams, file: File) => {
    void mutateAsync(params, file)
  })

  return {
    sentMb,
    totalMb,
    variables,
    mutate,
    mutateAsync,
    context: uploadFileEndMutation.context,
    data: uploadFileEndMutation.data,
    failureCount:
      uploadFileEndMutation.failureCount +
      uploadFileChunkMutation.failureCount +
      uploadFileStartMutation.failureCount,
    failureReason:
      uploadFileEndMutation.failureReason ??
      uploadFileChunkMutation.failureReason ??
      uploadFileStartMutation.failureReason,
    isError:
      uploadFileStartMutation.isError ||
      uploadFileChunkMutation.isError ||
      uploadFileEndMutation.isError,
    error:
      uploadFileEndMutation.error ?? uploadFileChunkMutation.error ?? uploadFileStartMutation.error,
    isPaused:
      uploadFileStartMutation.isPaused ||
      uploadFileChunkMutation.isPaused ||
      uploadFileEndMutation.isPaused,
    isPending:
      uploadFileStartMutation.isPending ||
      uploadFileChunkMutation.isPending ||
      uploadFileEndMutation.isPending,
    isSuccess: uploadFileEndMutation.isSuccess,
  }
}

/** Call "delete" mutations for a list of assets. */
export function deleteAssetsMutationOptions(backend: Backend) {
  return mutationOptions({
    mutationKey: [backend.type, 'deleteAssets'],
    mutationFn: async ([ids, force]: readonly [ids: readonly AssetId[], force: boolean]) => {
      const results = await Promise.allSettled(
        ids.map((id) => backend.deleteAsset(id, { force }, '(unknown)')),
      )
      const errors = results.flatMap((result): unknown =>
        result.status === 'rejected' ? [result.reason] : [],
      )
      if (errors.length !== 0) {
        throw Object.assign(new Error(errors.map(getMessageOrToString).join('\n')), {
          errors,
          failed: errors.length,
          total: ids.length,
        })
      }
      return null
    },
    meta: {
      invalidates: [
        [backend.type, 'listDirectory'],
        [backend.type, 'listAssetVersions'],
      ],
      awaitInvalidates: true,
    },
  })
}

/** The type of a "delete assets" mutation. */
type DeleteAssetsMutation = Mutation<
  null,
  Error,
  readonly [ids: readonly AssetId[], force: boolean]
>

/** Return matching in-flight "delete assets" mutations. */
export function useDeleteAssetsMutationState<Result>(
  backend: Backend,
  options: {
    predicate?: (mutation: DeleteAssetsMutation) => boolean
    select?: (mutation: DeleteAssetsMutation) => Result
  } = {},
) {
  const { predicate, select } = options
  return useMutationState({
    filters: {
      ...deleteAssetsMutationOptions(backend),
      predicate: (mutation: DeleteAssetsMutation) =>
        mutation.state.status === 'pending' && (predicate?.(mutation) ?? true),
    },
    // This is UNSAFE when the `Result` parameter is explicitly specified in the
    // generic parameter list.
    // eslint-disable-next-line no-restricted-syntax
    select: select as (mutation: Mutation<unknown, Error, unknown, unknown>) => Result,
  })
}

/** Call "restore" mutations for a list of assets. */
export function restoreAssetsMutationOptions(backend: Backend) {
  return mutationOptions({
    mutationKey: [backend.type, 'restoreAssets'],
    mutationFn: async (ids: readonly AssetId[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => backend.undoDeleteAsset(id, '(unknown)')),
      )
      const errors = results.flatMap((result): unknown =>
        result.status === 'rejected' ? [result.reason] : [],
      )
      if (errors.length !== 0) {
        throw Object.assign(new Error(errors.map(getMessageOrToString).join('\n')), {
          errors,
          failed: errors.length,
          total: ids.length,
        })
      }
      return null
    },
    meta: {
      invalidates: [[backend.type, 'listDirectory']],
      awaitInvalidates: true,
    },
  })
}

/** The type of a "restore assets" mutation. */
type RestoreAssetsMutation = Mutation<null, Error, readonly AssetId[]>

/** Return matching in-flight "restore assets" mutations. */
export function useRestoreAssetsMutationState<Result>(
  backend: Backend,
  options: {
    predicate?: (mutation: RestoreAssetsMutation) => boolean
    select?: (mutation: RestoreAssetsMutation) => Result
  } = {},
) {
  const { predicate, select } = options
  return useMutationState({
    filters: {
      ...restoreAssetsMutationOptions(backend),
      predicate: (mutation: RestoreAssetsMutation) =>
        mutation.state.status === 'pending' && (predicate?.(mutation) ?? true),
    },
    // This is UNSAFE when the `Result` parameter is explicitly specified in the
    // generic parameter list.
    // eslint-disable-next-line no-restricted-syntax
    select: select as (mutation: Mutation<unknown, Error, unknown, unknown>) => Result,
  })
}

/** Call "copy" mutations for a list of assets. */
export function copyAssetsMutationOptions(backend: Backend) {
  return mutationOptions({
    mutationKey: [backend.type, 'copyAssets'],
    mutationFn: async ([ids, parentId]: [ids: readonly AssetId[], parentId: DirectoryId]) => {
      const results = await Promise.allSettled(
        ids.map((id) => backend.copyAsset(id, parentId, '(unknown)', '(unknown)')),
      )
      const errors = results.flatMap((result): unknown =>
        result.status === 'rejected' ? [result.reason] : [],
      )
      if (errors.length !== 0) {
        throw Object.assign(new Error(errors.map(getMessageOrToString).join('\n')), {
          errors,
          failed: errors.length,
          total: ids.length,
        })
      }
      return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
    },
    meta: {
      invalidates: [[backend.type, 'listDirectory']],
      awaitInvalidates: true,
    },
  })
}

/** Call "move" mutations for a list of assets. */
export function moveAssetsMutationOptions(backend: Backend) {
  return mutationOptions({
    mutationKey: [backend.type, 'moveAssets'],
    mutationFn: async ([ids, parentId]: [ids: readonly AssetId[], parentId: DirectoryId]) => {
      const results = await Promise.allSettled(
        ids.map((id) =>
          backend.updateAsset(id, { description: null, parentDirectoryId: parentId }, '(unknown)'),
        ),
      )
      const errors = results.flatMap((result): unknown =>
        result.status === 'rejected' ? [result.reason] : [],
      )
      if (errors.length !== 0) {
        throw Object.assign(new Error(errors.map(getMessageOrToString).join('\n')), {
          errors,
          failed: errors.length,
          total: ids.length,
        })
      }
      return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
    },
    meta: {
      invalidates: [
        [backend.type, 'listDirectory'],
        [backend.type, 'listAssetVersions'],
      ],
      awaitInvalidates: true,
    },
  })
}

/** Remove the user's own permission from an asset. */
export function useRemoveSelfPermissionMutation(backend: Backend) {
  const { user } = useFullUserSession()

  const createPermissionMutation = useMutation(
    backendMutationOptions(backend, 'createPermission', {
      meta: {
        invalidates: [[backend.type, 'listDirectory']],
        awaitInvalidates: true,
      },
    }),
  )

  return useMutation({
    mutationKey: [backend.type, 'removeSelfPermission'],
    mutationFn: async (id: AssetId) => {
      await createPermissionMutation.mutateAsync([
        {
          action: null,
          resourceId: id,
          actorsIds: [user.userId],
        },
      ])
      return null
    },
    meta: {
      invalidates: [[backend.type, 'listDirectory']],
      awaitInvalidates: true,
    },
  })
}

/** Clear the trash folder. */
export function useClearTrashMutation(backend: Backend) {
  const queryClient = useQueryClient()
  const deleteAssetsMutation = useMutation(deleteAssetsMutationOptions(backend))

  return useMutation({
    mutationKey: [backend.type, 'clearTrash'],
    mutationFn: async () => {
      const trashedItems = await queryClient.ensureQueryData(
        backendQueryOptions(backend, 'listDirectory', [
          {
            parentId: null,
            labels: null,
            filterBy: backendModule.FilterBy.trashed,
            recentProjects: false,
          },
          '(unknown)',
        ]),
      )
      await deleteAssetsMutation.mutateAsync([trashedItems.map((item) => item.id), true])
      return null
    },
  })
}

/** Duplicate a specific version of a project. */
export function useDuplicateProjectMutation(backend: Backend) {
  const queryClient = useQueryClient()
  const toastAndLog = useToastAndLog()
  const doOpenProject = useOpenProject()

  return useMutation({
    mutationFn: async ([id, originalTitle, parentId, versionId]: [
      id: backendModule.ProjectId,
      originalTitle: string,
      parentId: backendModule.DirectoryId,
      versionId: backendModule.S3ObjectVersionId,
    ]) => {
      const siblings = await queryClient.ensureQueryData(
        backendQueryOptions(backend, 'listDirectory', [
          {
            parentId,
            labels: null,
            filterBy: backendModule.FilterBy.active,
            recentProjects: false,
          },
          '(unknown)',
        ]),
      )
      const siblingTitles = new Set(siblings.map((sibling) => sibling.title))
      let index = 1
      let title = `${originalTitle} (${index})`
      while (siblingTitles.has(title)) {
        index += 1
        title = `${originalTitle} (${index})`
      }

      await backend
        .duplicateProject(id, versionId, title)
        .catch((error) => {
          toastAndLog('createProjectError', error)
          throw error
        })
        .then((project) => {
          doOpenProject({
            type: backend.type,
            parentId,
            title,
            id: project.projectId,
          })
        })
    },
  })
}

/** Call "download" mutations for a list of assets. */
export function useDownloadAssetsMutation(backend: Backend) {
  const queryClient = useQueryClient()
  const toastAndLog = useToastAndLog()
  const { getText } = useText()

  return useMutation({
    mutationFn: async (infos: readonly { id: AssetId; title: string }[]) => {
      const results = await Promise.allSettled(
        infos.map(async ({ id, title }) => {
          const asset = backendModule.extractTypeFromId(id)
          if (backend.type === BackendType.remote) {
            switch (asset.type) {
              case backendModule.AssetType.project: {
                try {
                  const details = await queryClient.fetchQuery(
                    backendQueryOptions(backend, 'getProjectDetails', [asset.id, true], {
                      staleTime: 0,
                    }),
                  )
                  if (details.url != null) {
                    await backend.download(details.url, `${title}.enso-project`)
                  } else {
                    const error: unknown = getText('projectHasNoSourceFilesPhrase')
                    toastAndLog('downloadProjectError', error, title)
                  }
                } catch (error) {
                  toastAndLog('downloadProjectError', error, title)
                }
                break
              }
              case backendModule.AssetType.file: {
                try {
                  const details = await queryClient.fetchQuery(
                    backendQueryOptions(backend, 'getFileDetails', [asset.id, '(unknown)', true], {
                      staleTime: 0,
                    }),
                  )
                  if (details.url != null) {
                    await backend.download(details.url, details.file.fileName ?? '')
                  } else {
                    const error: unknown = getText('fileNotFoundPhrase')
                    toastAndLog('downloadFileError', error, title)
                  }
                } catch (error) {
                  toastAndLog('downloadFileError', error, '(unknown)')
                }
                break
              }
              case backendModule.AssetType.datalink: {
                try {
                  const value = await queryClient.fetchQuery(
                    backendQueryOptions(backend, 'getDatalink', [asset.id, '(unknown)']),
                  )
                  const fileName = `${title}.datalink`
                  download(
                    URL.createObjectURL(
                      new File([JSON.stringify(value)], fileName, {
                        type: 'application/json+x-enso-data-link',
                      }),
                    ),
                    fileName,
                  )
                } catch (error) {
                  toastAndLog('downloadDatalinkError', error, '(unknown)')
                }
                break
              }
              default: {
                toastAndLog('downloadInvalidTypeError')
                break
              }
            }
          } else {
            if (asset.type === backendModule.AssetType.project) {
              const typeAndId = extractTypeAndId(asset.id)
              const queryString = new URLSearchParams({
                projectsDirectory: typeAndId.directory,
              }).toString()
              await backend.download(
                `./api/project-manager/projects/${typeAndId.id}/enso-project?${queryString}`,
                `${title}.enso-project`,
              )
            }
          }
        }),
      )
      const errors = results.flatMap((result): unknown =>
        result.status === 'rejected' ? [result.reason] : [],
      )
      if (errors.length !== 0) {
        throw Object.assign(new Error(errors.map(getMessageOrToString).join('\n')), {
          errors,
          failed: errors.length,
          total: infos.length,
        })
      }
      return null
    },
  })
}

/** Call "add label" mutations for a list of assets. */
export function addAssetsLabelsMutationOptions(backend: Backend) {
  return mutationOptions({
    mutationFn: async ([infos, labelNames]: [
      infos: readonly {
        id: AssetId
        labels: readonly backendModule.LabelName[] | null
      }[],
      labelNames: readonly backendModule.LabelName[],
    ]) => {
      const results = await Promise.allSettled(
        infos.map(async ({ id, labels }) => {
          const newLabels = [
            ...new Set([
              ...(labels ?? []),
              ...labelNames.filter((label) => labels?.includes(label) !== true),
            ]),
          ]
          if (newLabels.length !== labels?.length) {
            await backend.associateTag(id, newLabels, '(unknown)')
          }
        }),
      )
      const errors = results.flatMap((result): unknown =>
        result.status === 'rejected' ? [result.reason] : [],
      )
      if (errors.length !== 0) {
        throw Object.assign(new Error(errors.map(getMessageOrToString).join('\n')), {
          errors,
          failed: errors.length,
          total: infos.length,
        })
      }
      return null
    },
    meta: {
      invalidates: [[backend.type, 'listDirectory']],
      awaitInvalidates: true,
    },
  })
}

/** Call "remove label" mutations for a list of assets. */
export function removeAssetsLabelsMutationOptions(backend: Backend) {
  return mutationOptions({
    mutationFn: async ([infos, labelNames]: [
      infos: readonly {
        id: AssetId
        labels: readonly backendModule.LabelName[] | null
      }[],
      labelNames: readonly backendModule.LabelName[],
    ]) => {
      const results = await Promise.allSettled(
        infos.map(async ({ id, labels }) => {
          const labelNamesSet = new Set(labelNames)
          const newLabels = (labels ?? []).filter((label) => !labelNamesSet.has(label))
          if (labels && newLabels.length !== labels.length) {
            await backend.associateTag(id, newLabels, '(unknown)')
          }
        }),
      )
      const errors = results.flatMap((result): unknown =>
        result.status === 'rejected' ? [result.reason] : [],
      )
      if (errors.length !== 0) {
        throw Object.assign(new Error(errors.map(getMessageOrToString).join('\n')), {
          errors,
          failed: errors.length,
          total: infos.length,
        })
      }
      return null
    },
    meta: {
      invalidates: [[backend.type, 'listDirectory']],
      awaitInvalidates: true,
    },
  })
}
