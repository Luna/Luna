/** @file An unstyled button with a focus ring and focus movement behavior. */
import * as React from 'react'

import * as focusHooks from '#/hooks/focusHooks'

import * as aria from '#/components/aria'
import * as ariaComponents from '#/components/AriaComponents'
import type * as focusRing from '#/components/styled/FocusRing'
import FocusRing from '#/components/styled/FocusRing'

// ======================
// === UnstyledButton ===
// ======================

/** Props for a {@link UnstyledButton}. */
export interface UnstyledButtonProps extends Readonly<React.PropsWithChildren> {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  readonly 'aria-label'?: string
  /** Falls back to `aria-label`. Pass `false` to explicitly disable the tooltip. */
  readonly tooltip?: React.ReactNode
  readonly focusRingPlacement?: focusRing.FocusRingPlacement
  readonly autoFocus?: boolean
  /** When `true`, the button is not clickable. */
  readonly isDisabled?: boolean
  readonly className?: string
  readonly style?: React.CSSProperties
  readonly onPress?: (event: aria.PressEvent) => void
}

/** An unstyled button with a focus ring and focus movement behavior. */
function UnstyledButton(props: UnstyledButtonProps, ref: React.ForwardedRef<HTMLButtonElement>) {
  const { tooltip, focusRingPlacement, children, ...buttonProps } = props
  const focusChildProps = focusHooks.useFocusChild()

  const tooltipElement = tooltip === false ? null : tooltip ?? buttonProps['aria-label']

  const button = (
    <FocusRing {...(focusRingPlacement == null ? {} : { placement: focusRingPlacement })}>
      <aria.Button
        {...aria.mergeProps<aria.ButtonProps & React.RefAttributes<HTMLButtonElement>>()(
          buttonProps,
          focusChildProps,
          { ref }
        )}
      >
        {children}
      </aria.Button>
    </FocusRing>
  )

  return tooltipElement == null ? (
    button
  ) : (
    <ariaComponents.TooltipTrigger delay={0} closeDelay={0}>
      {button}
      <ariaComponents.Tooltip>{tooltipElement}</ariaComponents.Tooltip>
    </ariaComponents.TooltipTrigger>
  )
}

export default React.forwardRef(UnstyledButton)
