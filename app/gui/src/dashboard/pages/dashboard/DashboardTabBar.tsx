/** @file The tab bar for the dashboard page. */
import DriveIcon from '#/assets/drive.svg'
import NetworkIcon from '#/assets/network.svg'
import SettingsIcon from '#/assets/settings.svg'

import ExpandArrowDownIcon from '#/assets/expand_arrow_down.svg'
import Plus2Icon from '#/assets/plus2.svg'
import { Button, Form, Input, Popover, Text } from '#/components/AriaComponents'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import TabBar from '#/layouts/TabBar'

import {
  TabType,
  useLaunchedProjects,
  usePage,
  useSetPage,
  type LaunchedProject,
} from '#/providers/ProjectsProvider'
import { useText } from '#/providers/TextProvider'
import type { ProjectId } from '#/services/Backend'
import type { TextId } from 'enso-common/src/text'
import { z } from 'zod'
import { WithFeatureFlag } from '../../providers/FeatureFlagsProvider'
import { TemplatesCarousel } from './components/TemplatesCarousel'

/** The props for the {@link DashboardTabBar} component. */
export interface DashboardTabBarProps {
  readonly onCloseProject: (project: LaunchedProject) => void
  readonly onOpenEditor: (projectId: ProjectId) => void
}

/** The tab bar for the dashboard page. */
export function DashboardTabBar(props: DashboardTabBarProps) {
  const { onCloseProject, onOpenEditor } = props

  const { getText } = useText()
  const page = usePage()
  const setPage = useSetPage()
  const launchedProjects = useLaunchedProjects()

  const onLoadEnd = useEventCallback((project: LaunchedProject) => {
    onOpenEditor(project.id)
  })

  const onClose = useEventCallback((project: LaunchedProject) => {
    onCloseProject(project)
  })

  const onCloseSettings = useEventCallback(() => {
    setPage(TabType.drive)
  })

  const tabs = [
    {
      id: TabType.drive,
      icon: DriveIcon,
      'data-testid': 'drive-tab-button',
      labelId: 'drivePageName' satisfies TextId,
      isActive: page === TabType.drive,
      children: getText('drivePageName'),
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Component: TabBar.Tab,
    },
    ...launchedProjects.map(
      (project) =>
        ({
          id: project.id,
          icon: NetworkIcon,
          'data-testid': 'editor-tab-button',
          labelId: 'editorPageName' satisfies TextId,
          // There is no shared enum type, but the other union member is the same type.
          // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
          isActive: page === project.id,
          children: project.title,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          Component: TabBar.ProjectTab,
          project,
          onClose,
          onLoadEnd,
        }) as const,
    ),
    {
      id: TabType.settings,
      icon: SettingsIcon,
      labelId: 'settingsPageName' satisfies TextId,
      'data-testid': 'settings-tab-button',
      isHidden: page !== TabType.settings,
      children: getText('settingsPageName'),
      onClose: onCloseSettings,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Component: TabBar.Tab,
    },
  ]

  return (
    <div className="flex flex-grow items-center bg-primary/10">
      <TabBar items={tabs} className="flex-none">
        {/* @ts-expect-error - Making ts happy here requires too much attention */}
        {(tab) => <tab.Component {...tab} />}
      </TabBar>

      <WithFeatureFlag flag="newProjectButtonView" showIf="tab_bar">
        <Button.GroupJoin
          buttonVariants={{ size: 'small', variant: 'ghost' }}
          verticalAlign="center"
        >
          <Button icon={Plus2Icon} tooltip={getText('newEmptyProject')} />

          <Popover.Trigger>
            <Button icon={ExpandArrowDownIcon} tooltip={getText('chooseATemplate')} />

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
                      close()
                    }}
                  >
                    <TemplatesCarousel onSelectTemplate={async (templateId, templateName) => {}} />

                    <Input name="name" label={getText('projectName')} autoFocus />

                    <Form.Submit>{getText('create')}</Form.Submit>
                  </Form>
                </div>
              )}
            </Popover>
          </Popover.Trigger>
        </Button.GroupJoin>
      </WithFeatureFlag>
    </div>
  )
}
