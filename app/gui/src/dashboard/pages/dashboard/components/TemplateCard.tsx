/**
 * @file Template card.
 */
import { Button, Text } from '#/components/AriaComponents'
import { StatelessSpinner } from '#/components/StatelessSpinner'
import { useMeasureSignal } from '#/hooks/measureHooks'
import { useToggle } from '#/hooks/toggleHooks'
import type { Sample } from '#/layouts/Samples'
import { motion, MotionConfig } from 'framer-motion'

/** Props for a {@link TemplateCard}. */
interface TemplateCardProps {
  readonly sample: Sample
  readonly onSelect: (templateId: string, templateName: string) => Promise<void>
  readonly isDisabled?: boolean
}

// eslint-disable-next-line no-restricted-syntax
const MotionText = motion(Text)

/** A button that, when clicked, creates and opens a new project based on a template. */
export function TemplateCard(props: TemplateCardProps) {
  const { sample, onSelect, isDisabled = false } = props

  const { id, title, description, background } = sample

  const [showText, toggleShowText] = useToggle(false)

  const [ref, { height }] = useMeasureSignal({
    onInitialMeasure: () => {
      toggleShowText()
    },
  })

  return (
    <Button
      variant="custom"
      size="custom"
      rounded="xxxlarge"
      key={title}
      hideLoader
      className="flex-none snap-center snap-always overflow-hidden"
      isDisabled={isDisabled}
      onPress={async () => {
        await onSelect(id, title)
      }}
    >
      {({ isHovered, isLoading }) => (
        <div className="relative flex aspect-[7/4] h-40 flex-col justify-end bg-primary/10">
          {/* eslint-disable-next-line @typescript-eslint/no-magic-numbers */}
          <MotionConfig transition={{ duration: 0.2, ease: 'easeInOut' }}>
            <motion.div
              style={{ background: background }}
              className="pointer-events-none absolute inset-0 bg-cover bg-center"
              animate={{
                // eslint-disable-next-line @typescript-eslint/no-magic-numbers
                opacity: isHovered ? 1 : 0.8,
                // eslint-disable-next-line @typescript-eslint/no-magic-numbers
                scale: isHovered ? 1.05 : 1,
              }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />

            {isLoading && (
              <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm">
                <StatelessSpinner state="loading-medium" size={16} />
              </div>
            )}

            <div
              className="isolate flex w-full flex-col items-start px-4 pb-3 text-start"
              style={{ opacity: showText ? 1 : 0 }}
            >
              <MotionText
                variant="body"
                color="invert"
                nowrap="normal"
                className="transition-all duration-200 ease-in-out"
                initial={{ y: '100%' }}
                style={{ y: isHovered ? 0 : height }}
              >
                {title}
              </MotionText>
              <MotionText
                ref={ref}
                variant="body-sm"
                color="invert"
                nowrap="normal"
                className="transition-all duration-200 ease-in-out"
                style={{
                  y: isHovered ? 0 : '100%',
                  opacity: isHovered ? 1 : 0,
                }}
              >
                {description}
              </MotionText>
            </div>
          </MotionConfig>
        </div>
      )}
    </Button>
  )
}
