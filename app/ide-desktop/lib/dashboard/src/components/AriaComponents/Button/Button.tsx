/** @file A styled button. */
import * as React from 'react'

import * as twv from 'tailwind-variants'

import * as focusHooks from '#/hooks/focusHooks'

import * as aria from '#/components/aria'
import * as ariaComponents from '#/components/AriaComponents'
import Spinner, * as spinnerModule from '#/components/Spinner'
import SvgMask from '#/components/SvgMask'

// ==============
// === Button ===
// ==============

/** Props for a {@link Button}. */
export type ButtonProps =
  | (BaseButtonProps & Omit<aria.ButtonProps, 'onPress'> & PropsWithoutHref)
  | (BaseButtonProps & Omit<aria.LinkProps, 'onPress'> & PropsWithHref)

/**
 * Props for a button with an href.
 */
interface PropsWithHref {
  readonly href: string
}

/**
 * Props for a button without an href.
 */
interface PropsWithoutHref {
  readonly href?: never
}

/**
 * Base props for a button.
 */
export interface BaseButtonProps extends Omit<twv.VariantProps<typeof BUTTON_STYLES>, 'iconOnly'> {
  /** Falls back to `aria-label`. Pass `false` to explicitly disable the tooltip. */
  readonly tooltip?: React.ReactNode
  /**
   * The icon to display in the button
   */
  readonly icon?: string | null
  /**
   * When `true`, icon will be shown only when hovered.
   */
  readonly showIconOnHover?: boolean
  /**
   * Handler that is called when the press is released over the target.
   * If the handler returns a promise, the button will be in a loading state until the promise resolves.
   */
  readonly onPress?: (event: aria.PressEvent) => Promise<void> | void

  readonly testId?: string
}

export const BUTTON_STYLES = twv.tv({
  base: 'group flex whitespace-nowrap cursor-pointer border border-transparent transition-[opacity,outline-offset,background,border-color] duration-150 ease-in-out select-none text-center items-center justify-center appearance-none',
  variants: {
    isDisabled: { true: 'disabled:opacity-50 disabled:cursor-not-allowed' },
    isFocused: {
      true: 'focus:outline-none focus-visible:outline focus-visible:outline-primary',
    },
    loading: { true: { base: 'cursor-wait', content: 'opacity-0' } },
    fullWidth: { true: 'w-full' },
    size: {
      custom: '',
      hero: 'px-8 py-4 text-lg',
      large: 'px-6 py-3 text-base',
      medium: 'px-4 py-2 text-sm',
      small: 'px-3 py-1 text-xs',
      xsmall: 'px-2 py-1 text-xs',
      xxsmall: 'px-1.5 py-0.5 text-xs',
    },
    iconOnly: { true: '' },
    rounded: {
      full: 'rounded-full',
      large: 'rounded-lg',
      medium: 'rounded-md',
      none: 'rounded-none',
      small: 'rounded-sm',
      xlarge: 'rounded-xl',
    },
    variant: {
      custom: 'focus-visible:outline-offset-2',
      link: 'inline-flex px-0 py-0 rounded-sm text-primary/50 underline hover:text-primary focus-visible:outline-offset-0',
      primary: 'bg-primary text-white hover:bg-primary/70 focus-visible:outline-offset-2',
      tertiary: 'bg-share text-white hover:bg-share/90 focus-visible:outline-offset-2',
      cancel: 'bg-selected-frame opacity-80 hover:opacity-100 focus-visible:outline-offset-2',
      delete: 'bg-delete text-white focus-visible:outline-offset-2',
      icon: {
        base: 'opacity-70 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-offset-0',
        wrapper: 'w-full h-full',
        content: 'w-full h-full',
        icon: 'w-fit h-fit',
      },

      submit: 'bg-invite text-white opacity-80 hover:opacity-100 focus-visible:outline-offset-2',
      outline:
        'border-primary/40 text-primary font-bold hover:border-primary/90 focus-visible:outline-offset-2',
    },
    iconPosition: {
      start: { content: '' },
      end: { content: 'flex-row-reverse' },
    },
    showIconOnHover: {
      true: { icon: 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100' },
    },
  },
  slots: {
    extraClickZone: 'flex relative after:inset-[-12px] after:absolute',
    wrapper: 'relative block',
    loader:
      'animate-appear-delayed absolute inset-0 flex items-center justify-center duration-1000',
    content: 'flex items-center gap-[0.5em] delay-1000 duration-0',
    icon: 'h-[1.5em] flex-none',
  },
  defaultVariants: {
    loading: false,
    fullWidth: false,
    size: 'xsmall',
    rounded: 'large',
    variant: 'primary',
    iconPosition: 'start',
    showIconOnHover: false,
  },
  compoundVariants: [
    { variant: 'icon', size: 'xxsmall', class: 'p-0.5 rounded-full', iconOnly: true },
    { variant: 'icon', size: 'xsmall', class: 'p-1 rounded-full', iconOnly: true },
    { variant: 'icon', size: 'small', class: 'p-1 rounded-full', iconOnly: true },
    { variant: 'icon', size: 'medium', class: 'p-2 rounded-full', iconOnly: true },
    { variant: 'icon', size: 'large', class: 'p-3 rounded-full', iconOnly: true },
    { variant: 'icon', size: 'hero', class: 'p-4 rounded-full', iconOnly: true },
  ],
})

/** A button allows a user to perform an action, with mouse, touch, and keyboard interactions. */
export const Button = React.forwardRef(function Button(
  props: ButtonProps,
  ref: React.ForwardedRef<HTMLButtonElement>
) {
  const {
    className,
    children,
    variant,
    icon,
    loading = false,
    isDisabled: disabled,
    showIconOnHover,
    iconPosition,
    size,
    fullWidth,
    rounded,
    tooltip,
    testId,
    onPress = () => {},
    ...ariaProps
  } = props
  const focusChildProps = focusHooks.useFocusChild()

  const [implicitlyLoading, setImplicitlyLoading] = React.useState(false)

  const isLink = ariaProps.href != null

  const Tag = isLink ? aria.Link : aria.Button

  const goodDefaults = isLink
    ? { rel: 'noopener noreferrer', 'data-testid': testId ?? 'link' }
    : { type: 'button', 'data-testid': testId ?? 'button' }
  const isIconOnly = (children == null || children === '' || children === false) && icon != null
  const shouldShowTooltip = isIconOnly && tooltip !== false
  const tooltipElement = shouldShowTooltip ? tooltip ?? ariaProps['aria-label'] : null

  const isLoading = loading || implicitlyLoading
  const isDisabled = disabled || isLoading

  const handlePress = (event: aria.PressEvent): void => {
    const result = onPress(event)

    if (result instanceof Promise) {
      setImplicitlyLoading(true)
      void result.finally(() => {
        setImplicitlyLoading(false)
      })
    }
  }

  const {
    base,
    content,
    wrapper,
    loader,
    extraClickZone,
    icon: iconClasses,
  } = BUTTON_STYLES({
    isDisabled,
    loading: isLoading,
    fullWidth,
    size,
    rounded,
    variant,
    iconPosition,
    showIconOnHover,
    iconOnly: isIconOnly,
  })

  const childrenFactory = (): React.ReactNode => {
    // Icon only button
    if (isIconOnly) {
      return (
        <span className={extraClickZone()}>
          <SvgMask src={icon} className={iconClasses()} />
        </span>
      )
    } else {
      // Default button
      return (
        <>
          {icon != null && <SvgMask src={icon} className={iconClasses()} />}
          <>{children}</>
        </>
      )
    }
  }

  const button = (
    <Tag
      // @ts-expect-error eventhough typescript is complaining about the type of ariaProps, it is actually correct
      {...aria.mergeProps()(goodDefaults, ariaProps, focusChildProps, {
        ref,
        isDisabled,
        // we use onPressEnd instead of onPress because for some reason react-aria doesn't trigger
        // onPress on EXTRA_CLICK_ZONE, but onPress{start,end} are triggered
        onPressEnd: handlePress,
      })}
      // @ts-expect-error eventhough typescript is complaining about the type of className, it is actually correct
      className={aria.composeRenderProps(className, (classNames, states) =>
        base({ className: classNames, ...states })
      )}
    >
      <span className={wrapper()}>
        <span className={content()}>{childrenFactory()}</span>

        {isLoading && (
          <span className={loader()}>
            <Spinner state={spinnerModule.SpinnerState.loadingMedium} size={16} />
          </span>
        )}
      </span>
    </Tag>
  )

  return tooltipElement == null ? (
    button
  ) : (
    <ariaComponents.TooltipTrigger>
      {button}
      <ariaComponents.Tooltip>{tooltipElement}</ariaComponents.Tooltip>
    </ariaComponents.TooltipTrigger>
  )
})
