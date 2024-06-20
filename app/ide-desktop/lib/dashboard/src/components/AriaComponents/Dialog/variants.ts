/**
 * @file
 *
 * Variants for the Dialog component.
 */
import * as twv from '#/utilities/tailwindVariants'

export const DIALOG_BACKGROUND = twv.tv({
  base: 'backdrop-blur-md',
  variants: {
    variant: {
      light: 'bg-white/80',
      dark: 'bg-primary/80',
    },
  },
  defaultVariants: {
    variant: 'light',
  },
})

export const DIALOG_STYLES = twv.tv({
  extend: DIALOG_BACKGROUND,
  base: 'flex flex-col text-left align-middle shadow-xl',
  variants: {
    rounded: {
      none: '',
      small: 'rounded-sm before:rounded-sm',
      medium: 'rounded-md before:rounded-md',
      large: 'rounded-lg before:rounded-lg',
      xlarge: 'rounded-xl before:rounded-xl',
      xxlarge: 'rounded-2xl before:rounded-2xl',
      xxxlarge: 'rounded-3xl before:rounded-3xl',
    },
  },
  defaultVariants: {
    rounded: 'xxlarge',
  },
})
