/** @file The React provider (and associated hooks) for providing reactive events. */
import { createContext, useContext, useMemo, type PropsWithChildren } from 'react'

import invariant from 'tiny-invariant'
import * as z from 'zod'

import { BackendType, type DirectoryId, type ProjectId } from 'enso-common/src/services/Backend'
import { EMPTY_ARRAY, includes } from 'enso-common/src/utilities/data/array'

import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { useSearchParamsState } from '#/hooks/searchParamsStateHooks'
import { useLocalStorageState } from '#/providers/LocalStorageProvider'
import LocalStorage from '#/utilities/LocalStorage'

/** Main content of the screen. Only one should be visible at a time. */
export enum TabType {
  drive = 'drive',
  settings = 'settings',
}

declare module '#/utilities/LocalStorage' {
  /** */
  interface LocalStorageData {
    readonly isAssetPanelVisible: boolean
    readonly page: z.infer<typeof PAGES_SCHEMA>
    readonly launchedProjects: z.infer<typeof LAUNCHED_PROJECT_SCHEMA>
  }
}

const PROJECT_SCHEMA = z
  .object({
    id: z.custom<ProjectId>((x) => typeof x === 'string' && x.startsWith('project-')),
    parentId: z.custom<DirectoryId>((x) => typeof x === 'string' && x.startsWith('directory-')),
    title: z.string(),
    type: z.nativeEnum(BackendType),
  })
  .readonly()
const LAUNCHED_PROJECT_SCHEMA = z.array(PROJECT_SCHEMA).readonly()

/** Launched project information. */
export type LaunchedProject = z.infer<typeof PROJECT_SCHEMA>
/** Launched project ID. */
export type LaunchedProjectId = ProjectId

LocalStorage.registerKey('launchedProjects', {
  isUserSpecific: true,
  schema: LAUNCHED_PROJECT_SCHEMA,
})

export const PAGES_SCHEMA = z
  .nativeEnum(TabType)
  .or(
    z.custom<LaunchedProjectId>(
      (value) => typeof value === 'string' && value.startsWith('project-'),
    ),
  )

LocalStorage.registerKey('page', { schema: PAGES_SCHEMA })

/** State contained in a `ProjectsContext`. */
export interface ProjectsContextType {
  readonly setLaunchedProjects: (launchedProjects: readonly LaunchedProject[]) => void
  readonly addLaunchedProject: (project: LaunchedProject) => void
  readonly removeLaunchedProject: (projectId: LaunchedProjectId) => void
  readonly updateLaunchedProjects: (
    update: (projects: readonly LaunchedProject[]) => readonly LaunchedProject[],
  ) => void
  readonly getState: () => {
    readonly launchedProjects: readonly LaunchedProject[]
    readonly page: LaunchedProjectId | TabType
  }
  readonly setPage: (page: LaunchedProjectId | TabType) => void
}

const ProjectsContext = createContext<ProjectsContextType | null>(null)
const PageContext = createContext<LaunchedProjectId | TabType | null>(null)
const LaunchedProjectsContext = createContext<readonly LaunchedProject[] | null>(null)

/** Props for a {@link ProjectsProvider}. */
export type ProjectsProviderProps = Readonly<PropsWithChildren>

/**
 * A React provider (and associated hooks) for determining whether the current area
 * containing the current element is focused.
 */
export default function ProjectsProvider(props: ProjectsProviderProps) {
  const { children } = props

  const [launchedProjects, setLaunchedProjects] = useLocalStorageState(
    'launchedProjects',
    EMPTY_ARRAY,
  )
  const [page, setPage] = useSearchParamsState(
    'page',
    () => TabType.drive,
    (value: unknown): value is LaunchedProjectId | TabType => {
      return includes(Object.values(TabType), value) || launchedProjects.some((p) => p.id === value)
    },
  )

  const addLaunchedProject = useEventCallback((project: LaunchedProject) => {
    setLaunchedProjects((current) => [...current, project])
  })
  const removeLaunchedProject = useEventCallback((projectId: LaunchedProjectId) => {
    setLaunchedProjects((current) => current.filter(({ id }) => id !== projectId))
  })
  const updateLaunchedProjects = useEventCallback(
    (update: (projects: readonly LaunchedProject[]) => readonly LaunchedProject[]) => {
      setLaunchedProjects((current) => update(current))
    },
  )

  const getState = useEventCallback(() => ({
    launchedProjects,
    page,
  }))

  const projectsContextValue = useMemo(
    () => ({
      updateLaunchedProjects,
      addLaunchedProject,
      removeLaunchedProject,
      setLaunchedProjects,
      setPage,
      getState,
    }),
    [
      updateLaunchedProjects,
      addLaunchedProject,
      removeLaunchedProject,
      setLaunchedProjects,
      setPage,
      getState,
    ],
  )

  return (
    <ProjectsContext.Provider value={projectsContextValue}>
      <PageContext.Provider value={page}>
        <LaunchedProjectsContext.Provider value={launchedProjects}>
          {children}
        </LaunchedProjectsContext.Provider>
      </PageContext.Provider>
    </ProjectsContext.Provider>
  )
}

/** The projects store. */
export function useProjectsStore() {
  const context = useContext(ProjectsContext)

  invariant(context != null, 'Projects store can only be used inside an `ProjectsProvider`.')

  return context
}

/** The page context. */
export function usePage() {
  const context = useContext(PageContext)

  invariant(context != null, 'Page context can only be used inside an `ProjectsProvider`.')

  return context
}

/** A function to set the current page. */
export function useSetPage() {
  const { setPage } = useProjectsStore()
  return useEventCallback((page: LaunchedProjectId | TabType) => {
    setPage(page)
  })
}

/** Returns the launched projects context. */
export function useLaunchedProjects() {
  const context = useContext(LaunchedProjectsContext)

  invariant(
    context != null,
    'Launched projects context can only be used inside an `ProjectsProvider`.',
  )

  return context
}

/** A function to update launched projects. */
export function useUpdateLaunchedProjects() {
  const { updateLaunchedProjects } = useProjectsStore()
  return updateLaunchedProjects
}

/** A function to add a new launched project. */
export function useAddLaunchedProject() {
  const { addLaunchedProject } = useProjectsStore()
  return addLaunchedProject
}

/** A function to remove a launched project. */
export function useRemoveLaunchedProject() {
  const { removeLaunchedProject } = useProjectsStore()
  return removeLaunchedProject
}

/** A function to remove all launched projects. */
export function useClearLaunchedProjects() {
  const { setLaunchedProjects } = useProjectsStore()

  return useEventCallback(() => {
    setLaunchedProjects([])
  })
}
