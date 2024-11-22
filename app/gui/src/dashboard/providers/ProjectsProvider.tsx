/** @file Provider for the list of opened projects. */
import * as React from 'react'

import invariant from 'tiny-invariant'

import * as eventCallbacks from '#/hooks/eventCallbackHooks'
import * as searchParamsState from '#/hooks/searchParamsStateHooks'
import * as array from '#/utilities/array'
import {
  TabType,
  useLaunchedProjectsState,
  type LaunchedProject,
  type LaunchedProjectId,
} from './ProjectsProvider/projectsLocalStorage'
export {
  TabType,
  type LaunchedProject,
  type LaunchedProjectId,
} from './ProjectsProvider/projectsLocalStorage'

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

const ProjectsContext = React.createContext<ProjectsContextType | null>(null)
const PageContext = React.createContext<LaunchedProjectId | TabType | null>(null)
const LaunchedProjectsContext = React.createContext<readonly LaunchedProject[] | null>(null)

/** Props for a {@link ProjectsProvider}. */
export type ProjectsProviderProps = Readonly<React.PropsWithChildren>

/** Provider for the list of opened projects. */
export default function ProjectsProvider(props: ProjectsProviderProps) {
  const { children } = props

  const [launchedProjects, setLaunchedProjects] = useLaunchedProjectsState(array.EMPTY_ARRAY)
  const [page, setPage] = searchParamsState.useSearchParamsState(
    'page',
    () => TabType.drive,
    (value: unknown): value is LaunchedProjectId | TabType => {
      return (
        array.includes(Object.values(TabType), value) ||
        launchedProjects.some((p) => p.id === value)
      )
    },
  )

  const addLaunchedProject = eventCallbacks.useEventCallback((project: LaunchedProject) => {
    setLaunchedProjects((current) => [...current, project])
  })
  const removeLaunchedProject = eventCallbacks.useEventCallback((projectId: LaunchedProjectId) => {
    setLaunchedProjects((current) => current.filter(({ id }) => id !== projectId))
  })
  const updateLaunchedProjects = eventCallbacks.useEventCallback(
    (update: (projects: readonly LaunchedProject[]) => readonly LaunchedProject[]) => {
      setLaunchedProjects((current) => update(current))
    },
  )

  const getState = eventCallbacks.useEventCallback(() => ({
    launchedProjects,
    page,
  }))

  const projectsContextValue = React.useMemo(
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
  const context = React.useContext(ProjectsContext)

  invariant(context != null, 'Projects store can only be used inside an `ProjectsProvider`.')

  return context
}

/** The page context. */
export function usePage() {
  const context = React.useContext(PageContext)
  invariant(context != null, 'Page context can only be used inside an `ProjectsProvider`.')
  return context
}

/** A function to set the current page. */
export function useSetPage() {
  const { setPage } = useProjectsStore()
  return eventCallbacks.useEventCallback((page: LaunchedProjectId | TabType) => {
    setPage(page)
  })
}

/** Returns the launched projects context. */
export function useLaunchedProjects() {
  const context = React.useContext(LaunchedProjectsContext)

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

  return eventCallbacks.useEventCallback(() => {
    setLaunchedProjects([])
  })
}
