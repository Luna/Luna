/**
 * @file
 *
 * A grid of templates.
 */
import { getSamplesGroup } from '#/layouts/Samples'

import { TemplateCard } from './TemplateCard'

/**
 *
 */
export interface TemplatesGridProps {
  readonly isDisabled?: boolean
  readonly onCreateProject: (
    templateId: string | null,
    templateName: string | null,
  ) => Promise<void>
}

/**
 * A grid of templates.
 */
export function TemplatesGrid(props: TemplatesGridProps) {
  const { isDisabled = false, onCreateProject } = props

  const getStartedSamples = getSamplesGroup('Get Started').filter(
    (sample) => sample.id !== 'Default',
  )
  const examplesSamples = getSamplesGroup('Examples')
  const advancedSamples = getSamplesGroup('Advanced')

  return (
    <div className="grid grid-cols-4 gap-4">
      {[...getStartedSamples, ...examplesSamples, ...advancedSamples].map((sample) => (
        <TemplateCard
          isDisabled={isDisabled}
          key={sample.id}
          sample={sample}
          createProject={onCreateProject}
        />
      ))}
    </div>
  )
}
