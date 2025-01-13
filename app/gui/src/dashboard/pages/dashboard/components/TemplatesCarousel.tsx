/**
 * @file Templates carousel.
 */

import ArrowRightIcon from '#/assets/arrow_right.svg'
import { Button } from '#/components/AriaComponents'
import { getSamplesGroup, type Sample, type SamplesGroup } from '#/layouts/Samples'
import { twMerge } from '#/utilities/tailwindMerge'
import { TemplateCard } from './TemplateCard'

/**
 * Props for the {@link TemplatesCarousel} component.
 */
export interface TemplatesCarouselProps {
  readonly className?: string
  readonly group?: SamplesGroup | SamplesGroup[]
  readonly isDisabled?: boolean
  readonly onSelectTemplate: (
    templateId: string | null,
    templateName: string | null,
  ) => Promise<void>
}

/**
 * A carousel of templates.
 */
export function TemplatesCarousel(props: TemplatesCarouselProps) {
  const { className, group, isDisabled = false, onSelectTemplate } = props

  let samples: Sample[] = []

  if (group != null) {
    if (Array.isArray(group)) {
      samples = group.flatMap((g) => getSamplesGroup(g))
    } else {
      samples = getSamplesGroup(group)
    }
  } else {
    samples = [...getSamplesGroup('Get Started'), ...getSamplesGroup('Examples')]
  }

  const samplesToDisplay = samples.slice(0, 5)

  const isMoreSamples = samples.length > samplesToDisplay.length

  return (
    <div
      className={twMerge(
        'inline-flex w-full snap-x snap-mandatory gap-4 overflow-x-auto scroll-hidden',
        className,
      )}
    >
      {samplesToDisplay.map((sample) => (
        <TemplateCard
          isDisabled={isDisabled}
          key={sample.id}
          sample={sample}
          onSelect={onSelectTemplate}
        />
      ))}

      {isMoreSamples && (
        <div className="flex h-full w-full items-center justify-center px-12">
          <Button
            icon={ArrowRightIcon}
            variant="ghost"
            aria-label="View more templates"
            size="hero"
          />
        </div>
      )}
    </div>
  )
}
