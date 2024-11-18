/** @file The tab panels for the dashboard page. */

import * as aria from '#/components/aria'

import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { useOpenProjectMutation, useRenameProjectMutation } from '#/hooks/projectHooks'
import type { AssetManagementApi } from '#/layouts/AssetsTable'
import type { Category } from '#/layouts/CategorySwitcher/Category'
import Drive from '#/layouts/Drive'
import type { GraphEditorRunner } from '#/layouts/Editor'
import Editor from '#/layouts/Editor'
import Settings from '#/layouts/Settings'
import { useLaunchedProjects, usePage } from '#/providers/ProjectsProvider'
import type { ProjectId } from '#/services/Backend'
import { Collection } from 'react-aria-components'

/** The props for the {@link DashboardTabPanels} component. */
export interface DashboardTabPanelsProps {
  readonly appRunner: GraphEditorRunner | null
  readonly initialProjectName: string | null
  readonly ydocUrl: string | null
  readonly assetManagementApiRef: React.RefObject<AssetManagementApi> | null
  readonly category: Category
  readonly setCategory: (category: Category) => void
}

/** The tab panels for the dashboard page. */
export function DashboardTabPanels(props: DashboardTabPanelsProps) {
  const { appRunner, initialProjectName, ydocUrl, assetManagementApiRef, category, setCategory } =
    props

  const page = usePage()

  const launchedProjects = useLaunchedProjects()
  const openProjectMutation = useOpenProjectMutation()
  const renameProjectMutation = useRenameProjectMutation()

  const onRenameProject = useEventCallback(async (newName: string, projectId: ProjectId) => {
    const project = launchedProjects.find((proj) => proj.id === projectId)

    if (project == null) {
      return
    }

    await renameProjectMutation.mutateAsync({ newName, project })
  })

  const tabPanels = [
    {
      id: 'drive',
      shouldForceMount: true,
      className: 'flex min-h-0 grow [&[data-inert]]:hidden',
      children: (
        <Drive
          assetsManagementApiRef={assetManagementApiRef}
          category={category}
          setCategory={setCategory}
          hidden={page !== 'drive'}
          initialProjectName={initialProjectName}
        />
      ),
    },

    ...launchedProjects.map((project) => ({
      id: project.id,
      shouldForceMount: true,
      className: 'flex min-h-0 grow [&[data-inert]]:hidden',
      children: (
        <Editor
          hidden={page !== project.id}
          ydocUrl={ydocUrl}
          project={project}
          projectId={project.id}
          appRunner={appRunner}
          isOpeningFailed={openProjectMutation.isError}
          openingError={openProjectMutation.error}
          startProject={openProjectMutation.mutate}
          renameProject={onRenameProject}
        />
      ),
    })),

    {
      id: 'settings',
      className: 'flex min-h-0 grow',
      children: <Settings />,
    },
  ]

  return (
    <Collection items={tabPanels}>
      {(tabPanelProps) => <aria.TabPanel {...tabPanelProps} />}
    </Collection>
  )
}
