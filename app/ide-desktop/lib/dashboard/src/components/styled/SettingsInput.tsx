/** @file A styled input specific to settings pages. */
import * as React from 'react'

import EyeCrossedIcon from 'enso-assets/eye_crossed.svg'
import EyeIcon from 'enso-assets/eye.svg'

import * as focusHooks from '#/hooks/focusHooks'

import * as textProvider from '#/providers/TextProvider'

import * as aria from '#/components/aria'
import Button from '#/components/styled/Button'
import FocusRing from '#/components/styled/FocusRing'

// =====================
// === SettingsInput ===
// =====================

/** Props for an {@link SettingsInput}. */
export interface SettingsInputProps {
  readonly isDisabled?: boolean
  readonly type?: string
  readonly placeholder?: string
  readonly autoComplete?: React.HTMLInputAutoCompleteAttribute
  readonly onChange?: React.ChangeEventHandler<HTMLInputElement>
  readonly onSubmit?: (event: React.SyntheticEvent<HTMLInputElement>) => void
}

/** A styled input specific to settings pages. */
function SettingsInput(props: SettingsInputProps, ref: React.ForwardedRef<HTMLInputElement>) {
  const { isDisabled = false, type, placeholder, autoComplete, onChange, onSubmit } = props
  const focusChildProps = focusHooks.useFocusChild()
  const { getText } = textProvider.useText()
  // This is SAFE. The value of this context is never a `SlottedContext`.
  // eslint-disable-next-line no-restricted-syntax
  const inputProps = (React.useContext(aria.InputContext) ?? null) as aria.InputProps | null
  const [isShowingPassword, setIsShowingPassword] = React.useState(false)
  const cancelled = React.useRef(false)

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'Escape': {
        cancelled.current = true
        event.stopPropagation()
        event.currentTarget.value = String(inputProps?.defaultValue ?? '')
        event.currentTarget.blur()
        break
      }
      default: {
        cancelled.current = false
        break
      }
    }
  }

  return (
    <div className="text my-auto grow font-bold">
      <FocusRing within placement="after">
        <aria.Group className="relative rounded-full after:pointer-events-none after:absolute after:inset after:rounded-full">
          <aria.Input
            {...aria.mergeProps<aria.InputProps & React.RefAttributes<HTMLInputElement>>()(
              {
                ref,
                className:
                  'w-full rounded-full bg-transparent font-bold placeholder-black/30 transition-colors invalid:border invalid:border-red-700 hover:bg-selected-frame focus:bg-selected-frame',
                ...(type == null ? {} : { type: isShowingPassword ? 'text' : type }),
                disabled: isDisabled,
                size: 1,
                autoComplete,
                placeholder,
                onKeyDown,
                onChange,
                onBlur: event => {
                  if (!cancelled.current) {
                    onSubmit?.(event)
                  }
                },
              },
              focusChildProps
            )}
          />
          {type === 'password' && (
            <Button
              active
              image={isShowingPassword ? EyeIcon : EyeCrossedIcon}
              alt={isShowingPassword ? getText('hidePassword') : getText('showPassword')}
              buttonClassName="absolute right-2 top-1 cursor-pointer rounded-full size-6"
              onPress={() => {
                setIsShowingPassword(show => !show)
              }}
            />
          )}
        </aria.Group>
      </FocusRing>
    </div>
  )
}

export default React.forwardRef(SettingsInput)
