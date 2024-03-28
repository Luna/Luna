/** @file A text `<span>` which turns into an `input` when desired. */
import * as React from 'react'

import CrossIcon from 'enso-assets/cross.svg'
import TickIcon from 'enso-assets/tick.svg'

import * as eventCalback from '#/hooks/eventCallbackHooks'

import * as inputBindingsProvider from '#/providers/InputBindingsProvider'
import * as textProvider from '#/providers/TextProvider'

import * as aria from '#/components/aria'
import FocusRing from '#/components/styled/FocusRing'
import UnstyledButton from '#/components/styled/UnstyledButton'
import SvgMask from '#/components/SvgMask'

import * as eventModule from '#/utilities/event'
import * as sanitizedEventTargets from '#/utilities/sanitizedEventTargets'

// ====================
// === EditableSpan ===
// ====================

/** Props for an {@link EditableSpan}. */
export interface EditableSpanProps {
  // This matches the capitalization of `data-` attributes in React.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  readonly 'data-testid'?: string
  readonly className?: string
  readonly editable?: boolean
  readonly checkSubmittable?: (value: string) => boolean
  readonly onSubmit: (value: string) => void
  readonly onCancel: () => void
  readonly inputPattern?: string
  readonly inputTitle?: string
  readonly children: string
}

/** A `<span>` that can turn into an `<input type="text">`. */
export default function EditableSpan(props: EditableSpanProps) {
  const { className, editable = false, children } = props
  const { checkSubmittable, onSubmit, onCancel, inputPattern, inputTitle } = props
  const { getText } = textProvider.useText()
  const inputBindings = inputBindingsProvider.useInputBindings()
  const [isSubmittable, setIsSubmittable] = React.useState(true)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const cancelled = React.useRef(false)

  // Making sure that the event callback is stable.
  // to prevent the effect from re-running.
  const onCancelEventCallback = eventCalback.useEventCallback(onCancel)

  React.useEffect(() => {
    console.log(checkSubmittable, inputRef.current?.value)
    setIsSubmittable(checkSubmittable?.(inputRef.current?.value ?? '') ?? true)
    // This effect MUST only run on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    if (editable) {
      return inputBindings.attach(sanitizedEventTargets.document.body, 'keydown', {
        cancelEditName: () => {
          onCancelEventCallback()
          cancelled.current = true
          inputRef.current?.blur()
        },
      })
    } else {
      return
    }
  }, [editable, /* should never change */ inputBindings, onCancelEventCallback])

  React.useEffect(() => {
    cancelled.current = false
  }, [editable])

  if (editable) {
    return (
      <form
        className="flex grow"
        onSubmit={event => {
          event.preventDefault()
          if (isSubmittable) {
            if (inputRef.current != null) {
              onSubmit(inputRef.current.value)
            }
          }
        }}
      >
        <aria.Input
          data-testid={props['data-testid']}
          className={className ?? ''}
          ref={inputRef}
          autoFocus
          type="text"
          size={1}
          defaultValue={children}
          onBlur={event => {
            if (!cancelled.current) {
              event.currentTarget.form?.requestSubmit()
            }
          }}
          onContextMenu={event => {
            event.stopPropagation()
          }}
          onKeyDown={event => {
            if (event.key !== 'Escape') {
              // The input may handle the event.
              if (event.key === 'Enter' && eventModule.areNoModifiersPressed(event)) {
                event.stopPropagation()
              } else {
                event.stopPropagation()
              }
            }
          }}
          {...(inputPattern == null ? {} : { pattern: inputPattern })}
          {...(inputTitle == null ? {} : { title: inputTitle })}
          {...(checkSubmittable == null
            ? {}
            : {
                onInput: event => {
                  setIsSubmittable(checkSubmittable(event.currentTarget.value))
                },
              })}
        />
        {isSubmittable && (
          <UnstyledButton
            className="mx-tick-cross-button my-auto flex rounded-full transition-colors hover:bg-hover-bg"
            onPress={eventModule.submitForm}
          >
            <SvgMask src={TickIcon} alt={getText('confirmEdit')} className="size-icon" />
          </UnstyledButton>
        )}
        <FocusRing>
          <UnstyledButton
            className="mx-tick-cross-button my-auto flex rounded-full transition-colors hover:bg-hover-bg"
            onPress={() => {
              cancelled.current = true
              onCancel()
              window.setTimeout(() => {
                cancelled.current = false
              })
            }}
          >
            <SvgMask src={CrossIcon} alt={getText('cancelEdit')} className="size-icon" />
          </UnstyledButton>
        </FocusRing>
      </form>
    )
  } else {
    return (
      <aria.Text data-testid={props['data-testid']} className={className}>
        {children}
      </aria.Text>
    )
  }
}
