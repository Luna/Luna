/** @file Mutations related to project management. */
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import invariant from 'tiny-invariant'

import {
  AssetType,
  BackendType,
  ProjectState,
  type AnyAsset,
  type Asset,
  type AssetId,
  type Backend,
  type DirectoryId,
  type ProjectAsset,
} from '@common/services/Backend'
import { merge } from '@common/utilities/data/object'

import { useEventCallback } from '#/hooks/eventCallbackHooks'

import { useFullUserSession } from '#/providers/AuthProvider'
import { useLocalBackend, useRemoteBackend } from '#/providers/BackendProvider'
import { useFeatureFlag } from '#/providers/FeatureFlagsProvider'
import {
  TabType,
  useAddLaunchedProject,
  useProjectsStore,
  useRemoveLaunchedProject,
  useSetPage,
  useUpdateLaunchedProjects,
  type LaunchedProject,
  type LaunchedProjectId,
} from '#/providers/ProjectsProvider'

/** Default interval for refetching project status when the project is opened. */
const OPENED_INTERVAL_MS = 30_000
/**
 * Interval when we open a cloud project.
 * Since opening a cloud project is a long operation, we want to check the status less often.
 */
const CLOUD_OPENING_INTERVAL_MS = 2_500
/**
 * Interval when we open a local project or when we want to sync the project status as soon as
 * possible.
 */
const LOCAL_OPENING_INTERVAL_MS = 100

const DEFAULT_INTERVAL_MS = 120_000

/** Options for {@link createGetProjectDetailsQuery}. */
export interface CreateOpenedProjectQueryOptions {
  readonly assetId: Asset<AssetType.project>['id']
  readonly parentId: Asset<AssetType.project>['parentId']
  readonly backend: Backend
}

/** Whether the user can open projects. */
export function useCanOpenProjects() {
  const localBackend = useLocalBackend()
  return localBackend != null
}

/** Return a function to update a project asset in the TanStack Query cache. */
function useSetProjectAsset() {
  const queryClient = useQueryClient()
  return useEventCallback(
    (
      backendType: BackendType,
      assetId: AssetId,
      parentId: DirectoryId,
      transform: (asset: ProjectAsset) => ProjectAsset,
    ) => {
      const listDirectoryQuery = queryClient
        .getQueryCache()
        .find<readonly AnyAsset<AssetType>[] | undefined>({
          queryKey: [backendType, 'listDirectory', parentId],
          exact: false,
        })

      if (listDirectoryQuery?.state.data) {
        listDirectoryQuery.setData(
          listDirectoryQuery.state.data.map((child) =>
            child.id === assetId && child.type === AssetType.project ? transform(child) : child,
          ),
        )
      }
    },
  )
}

/** Project status query.  */
export function createGetProjectDetailsQuery(options: CreateOpenedProjectQueryOptions) {
  const { assetId, parentId, backend } = options

  const isLocal = backend.type === BackendType.local

  return queryOptions({
    queryKey: createGetProjectDetailsQuery.getQueryKey(assetId),
    queryFn: () => backend.getProjectDetails(assetId, parentId),
    meta: { persist: false },
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    networkMode: backend.type === BackendType.remote ? 'online' : 'always',
    refetchInterval: ({ state }): number | false => {
      const staticStates = [ProjectState.opened, ProjectState.closed]

      const openingStates = [
        ProjectState.provisioned,
        ProjectState.scheduled,
        ProjectState.openInProgress,
        ProjectState.closing,
      ]

      const createdStates = [ProjectState.created, ProjectState.new]

      if (state.status === 'error') {
        return false
      }

      if (state.data == null) {
        return false
      }

      const currentState = state.data.state.type

      if (isLocal) {
        if (createdStates.includes(currentState)) {
          return LOCAL_OPENING_INTERVAL_MS
        }

        if (staticStates.includes(state.data.state.type)) {
          return OPENED_INTERVAL_MS
        }

        if (openingStates.includes(state.data.state.type)) {
          return LOCAL_OPENING_INTERVAL_MS
        }
      }

      if (createdStates.includes(currentState)) {
        return CLOUD_OPENING_INTERVAL_MS
      }

      // Cloud project
      if (staticStates.includes(state.data.state.type)) {
        return OPENED_INTERVAL_MS
      }
      if (openingStates.includes(state.data.state.type)) {
        return CLOUD_OPENING_INTERVAL_MS
      }

      return DEFAULT_INTERVAL_MS
    },
  })
}
createGetProjectDetailsQuery.getQueryKey = (id: LaunchedProjectId) => ['project', id] as const

/** A mutation to open a project. */
export function useOpenProjectMutation() {
  const client = useQueryClient()
  const session = useFullUserSession()
  const remoteBackend = useRemoteBackend()
  const localBackend = useLocalBackend()
  const setProjectAsset = useSetProjectAsset()

  return useMutation({
    mutationKey: ['openProject'],
    networkMode: 'always',
    mutationFn: ({
      title,
      id,
      type,
      parentId,
      inBackground = false,
    }: LaunchedProject & { inBackground?: boolean }) => {
      const backend = type === BackendType.remote ? remoteBackend : localBackend

      invariant(backend != null, 'Backend is null')

      return backend.openProject(
        id,
        {
          executeAsync: inBackground,
          cognitoCredentials: {
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            clientId: session.clientId,
            expireAt: session.expireAt,
            refreshUrl: session.refreshUrl,
          },
          parentId,
        },
        title,
      )
    },
    onMutate: ({ type, id, parentId }) => {
      const queryKey = createGetProjectDetailsQuery.getQueryKey(id)

      client.setQueryData(queryKey, { state: { type: ProjectState.openInProgress } })
      setProjectAsset(type, id, parentId, (asset) => ({
        ...asset,
        projectState: { ...asset.projectState, type: ProjectState.openInProgress },
      }))

      void client.cancelQueries({ queryKey })
    },
    onSuccess: async (_, { type, id, parentId }) => {
      await client.resetQueries({ queryKey: createGetProjectDetailsQuery.getQueryKey(id) })
      await client.invalidateQueries({ queryKey: [type, 'listDirectory', parentId] })
    },
    onError: async (_, { type, id, parentId }) => {
      await client.invalidateQueries({ queryKey: createGetProjectDetailsQuery.getQueryKey(id) })
      await client.invalidateQueries({ queryKey: [type, 'listDirectory', parentId] })
    },
  })
}

/** Mutation to close a project. */
export function useCloseProjectMutation() {
  const client = useQueryClient()
  const remoteBackend = useRemoteBackend()
  const localBackend = useLocalBackend()
  const setProjectAsset = useSetProjectAsset()

  return useMutation({
    mutationKey: ['closeProject'],
    mutationFn: ({ type, id, title }: LaunchedProject) => {
      const backend = type === BackendType.remote ? remoteBackend : localBackend

      invariant(backend != null, 'Backend is null')

      return backend.closeProject(id, title)
    },
    onMutate: ({ type, id, parentId }) => {
      const queryKey = createGetProjectDetailsQuery.getQueryKey(id)

      client.setQueryData(queryKey, { state: { type: ProjectState.closing } })
      setProjectAsset(type, id, parentId, (asset) => ({
        ...asset,
        projectState: { ...asset.projectState, type: ProjectState.closing },
      }))

      void client.cancelQueries({ queryKey })
    },
    onSuccess: async (_, { type, id, parentId }) => {
      await client.resetQueries({ queryKey: createGetProjectDetailsQuery.getQueryKey(id) })
      setProjectAsset(type, id, parentId, (asset) => ({
        ...asset,
        projectState: { ...asset.projectState, type: ProjectState.closed },
      }))
    },
    onError: async (_, { type, id, parentId }) => {
      await client.invalidateQueries({ queryKey: createGetProjectDetailsQuery.getQueryKey(id) })
      await client.invalidateQueries({ queryKey: [type, 'listDirectory', parentId] })
    },
  })
}

/** Mutation to rename a project. */
export function useRenameProjectMutation() {
  const client = useQueryClient()
  const remoteBackend = useRemoteBackend()
  const localBackend = useLocalBackend()
  const updateLaunchedProjects = useUpdateLaunchedProjects()

  return useMutation({
    mutationKey: ['renameProject'],
    mutationFn: ({ newName, project }: { newName: string; project: LaunchedProject }) => {
      const { type, id, title } = project
      const backend = type === BackendType.remote ? remoteBackend : localBackend

      invariant(backend != null, 'Backend is null')

      return backend.updateProject(id, { projectName: newName, ami: null, ideVersion: null }, title)
    },
    onSuccess: (_, { newName, project }) => {
      updateLaunchedProjects((projects) =>
        projects.map((otherProject) =>
          project.id !== otherProject.id ? otherProject : merge(otherProject, { title: newName }),
        ),
      )
      return client.invalidateQueries({
        queryKey: createGetProjectDetailsQuery.getQueryKey(project.id),
      })
    },
  })
}

/** A callback to open a project. */
export function useOpenProject() {
  const client = useQueryClient()
  const canOpenProjects = useCanOpenProjects()
  const projectsStore = useProjectsStore()
  const addLaunchedProject = useAddLaunchedProject()
  const closeAllProjects = useCloseAllProjects()
  const openProjectMutation = useOpenProjectMutation()

  const enableMultitabs = useFeatureFlag('enableMultitabs')

  return useEventCallback((project: LaunchedProject) => {
    if (!canOpenProjects) {
      return
    }

    if (!enableMultitabs) {
      // Since multiple tabs cannot be opened at the same time, the opened projects need to be closed first.
      if (projectsStore.getState().launchedProjects.length > 0) {
        closeAllProjects()
      }
    }

    const existingMutation = client.getMutationCache().find({
      mutationKey: ['openProject'],
      predicate: (mutation) => mutation.options.scope?.id === project.id,
    })
    const isOpeningTheSameProject = existingMutation?.state.status === 'pending'

    if (!isOpeningTheSameProject) {
      openProjectMutation.mutate(project)
      const openingProjectMutation = client.getMutationCache().find({
        mutationKey: ['openProject'],
        // this is unsafe, but we can't do anything about it
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        predicate: (mutation) => mutation.state.variables?.id === project.id,
      })
      openingProjectMutation?.setOptions({
        ...openingProjectMutation.options,
        scope: { id: project.id },
      })

      addLaunchedProject(project)
    }
  })
}

/** A function to open the editor. */
export function useOpenEditor() {
  const setPage = useSetPage()
  return useEventCallback((projectId: LaunchedProjectId) => {
    setPage(projectId)
  })
}

/** A function to close a project. */
export function useCloseProject() {
  const client = useQueryClient()
  const closeProjectMutation = useCloseProjectMutation()
  const removeLaunchedProject = useRemoveLaunchedProject()
  const setPage = useSetPage()

  return useEventCallback((project: LaunchedProject) => {
    client
      .getMutationCache()
      .findAll({
        mutationKey: ['openProject'],
        predicate: (mutation) => mutation.options.scope?.id === project.id,
      })
      .forEach((mutation) => {
        mutation.setOptions({ ...mutation.options, retry: false })
        mutation.destroy()
      })

    closeProjectMutation.mutate(project)

    client
      .getMutationCache()
      .findAll({
        mutationKey: ['closeProject'],
        // This is unsafe, but we cannot do anything about it.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        predicate: (mutation) => mutation.state.variables?.id === project.id,
      })
      .forEach((mutation) => {
        mutation.setOptions({ ...mutation.options, scope: { id: project.id } })
      })

    removeLaunchedProject(project.id)

    setPage(TabType.drive)
  })
}

/** A function to close all projects. */
export function useCloseAllProjects() {
  const closeProject = useCloseProject()
  const projectsStore = useProjectsStore()

  return useEventCallback(() => {
    const launchedProjects = projectsStore.getState().launchedProjects

    for (const launchedProject of launchedProjects) {
      closeProject(launchedProject)
    }
  })
}
