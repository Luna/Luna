/**
 * @file New project dropdown content.
 */

import * as aria from '#/components/aria'
import { Button } from '#/components/aria'
import { getSamplesGroup } from '#/layouts/Samples'

/**
 *
 */
export interface NewProjectDropdownContentProps {
  readonly onCreateProject: (
    templateId: string | null,
    templateName: string | null,
  ) => Promise<void>
}

/**
 *
 */
export function NewProjectDropdownContent(props: NewProjectDropdownContentProps) {
  const { onCreateProject } = props

  const getStartedSamples = getSamplesGroup('Get Started').filter(
    (sample) => sample.id !== 'Default',
  )
  const examplesSamples = getSamplesGroup('Examples')
  const advancedSamples = getSamplesGroup('Advanced')

  return <div />
}
