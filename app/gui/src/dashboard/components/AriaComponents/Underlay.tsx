/** @file An underlay that covers the entire screen. */
import { DIALOG_BACKGROUND } from '#/components/AriaComponents/Dialog'
import type { VariantProps } from '#/utilities/tailwindVariants'
import type { HTMLAttributes } from 'react'

/**
 * Props for the {@link Underlay} component.
 */
export interface UnderlayProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof DIALOG_BACKGROUND> {}

/** An underlay that covers the entire screen. */
export function Underlay(props: UnderlayProps) {
  const { className, variants = DIALOG_BACKGROUND, variant, ...rest } = props

  return <div className={variants({ className, variant })} {...rest} />
}
