/**
 * @file
 *
 * Card component.
 */

import { tv, type VariantProps } from '#/utilities/tailwindVariants'
import { type ComponentProps } from 'react'
import type { TestIdProps } from '../AriaComponents'

const CARD_STYLES = tv({
  base: 'rounded-lg border border-primary/20 bg-white p-4',
})

/** Props for a {@link Card} component. */
export interface CardProps
  extends ComponentProps<'div'>,
    VariantProps<typeof CARD_STYLES>,
    TestIdProps {
  readonly onPress?: () => void
}

/** Card component. */
export function Card(props: CardProps) {
  const {
    variants = CARD_STYLES,
    testId,
    className,
    children,
    onPress,
    ...passThroughProps
  } = props

  return (
    <div {...passThroughProps} className={variants({ className })} data-testid={testId}>
      {children}
    </div>
  )
}
