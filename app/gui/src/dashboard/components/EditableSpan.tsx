/** @file A text `<span>` which turns into an `input` when desired. */
import * as React from 'react'

import CrossIcon from '#/assets/cross.svg'
import TickIcon from '#/assets/tick.svg'

import { Input, Text } from '#/components/AriaComponents'
import * as textProvider from '#/providers/TextProvider'
import * as tailwindMerge from '#/utilities/tailwindMerge'

import { useInteractOutside } from '#/components/aria'
import { Form, Underlay } from '#/components/AriaComponents'
import { useAutoFocus } from '#/hooks/autoFocusHooks'
import { useMeasure } from '#/hooks/measureHooks'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { useLayoutEffect } from 'react'
import type { z } from 'zod'

/**
 * Props for {@link EditableSpan}.
 */
export interface EditableSpanProps {
  readonly 'data-testid'?: string
  readonly className?: string
  readonly editable?: boolean
  readonly onSubmit: (value: string) => Promise<void>
  readonly onCancel: () => void
  readonly children: string
  /**
   * Additional schema to validate the value.
   */
  readonly schema?: (schema: typeof z) => z.ZodType<string>
}

/** A `<span>` that can turn into an `<input type="text">`. */
export default function EditableSpan(props: EditableSpanProps) {
  const { className = '', editable = false, children } = props

  if (editable) {
    return <EditForm {...props} />
  }

  return (
    <Text testId={props['data-testid']} truncate="1" className={className}>
      {children}
    </Text>
  )
}

/**
 * Props for {@link EditForm}.
 */
interface EditFormProps extends EditableSpanProps {}

const CONTAINER_VARIANTS: Variants = {
  hidden: {
    opacity: 0,
    transition: {
      staggerChildren: 1,
    },
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 1,
    },
  },
}

const CHILD_VARIANTS: Variants = {
  hidden: { opacity: 0, x: 5 },
  visible: { opacity: 1, x: 0 },
}

// eslint-disable-next-line @typescript-eslint/no-magic-numbers
const TRANSITION_OPTIONS = { stiffness: 300, damping: 150, mass: 1 }

/**
 * Edit form for {@link EditableSpan}.
 */
function EditForm(props: EditFormProps) {
  const { className = '', children, onSubmit, onCancel, schema } = props

  const { getText } = textProvider.useText()

  const formRef = React.useRef<HTMLFormElement | null>(null)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const form = Form.useForm({
    schema: (z) => {
      const baseSchema = z.object({ value: z.string().min(1).trim() })

      if (schema != null) {
        return baseSchema.merge(z.object({ value: schema(z) }))
      }

      return baseSchema
    },
    defaultValues: { value: children },
    onSubmit: ({ value }) => onSubmit(value),
  })

  useInteractOutside({ ref: formRef, onInteractOutside: onCancel })
  useAutoFocus({ ref: inputRef })

  const { error } = Form.useFieldState({ name: 'value', form })
  const formErrors = Form.useFormError({ form })

  const errorMessage = (() => {
    if (error != null) {
      return error
    }

    if (formErrors.length > 0) {
      return formErrors
        .filter(({ type }) => type === 'error')
        .map(({ message }) => message)
        .join('\n')
    }

    return null
  })()

  const hasError = errorMessage != null

  return (
    <form ref={formRef} className="relative flex grow gap-1.5" {...form.formProps}>
      <Form.Provider form={form}>
        <div className="flex flex-1 flex-shrink-0 basis-full items-center">
          <Input
            inputRef={inputRef}
            name="value"
            variant="custom"
            size="custom"
            rounded="none"
            testId={props['data-testid']}
            className={tailwindMerge.twJoin('flex-shrink-0 flex-grow basis-0', className)}
            type="text"
            aria-label={getText('editNameShortcut')}
            // we don't want the display the default error message
            error={null}
            onContextMenu={(event) => {
              event.stopPropagation()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                onCancel()
              }
              event.stopPropagation()
            }}
          />

          {hasError && <ErrorMessage message={errorMessage} formRef={formRef} />}

          <AnimatePresence>
            {form.formState.isDirty && (
              <motion.div
                variants={CONTAINER_VARIANTS}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="ml-1 flex w-auto flex-none basis-0 items-center gap-1.5"
              >
                <motion.div
                  variants={CHILD_VARIANTS}
                  transition={TRANSITION_OPTIONS}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                >
                  <Form.Submit
                    size="medium"
                    variant="icon"
                    icon={TickIcon}
                    aria-label={getText('confirmEdit')}
                    children={null}
                  />
                </motion.div>

                <motion.div
                  variants={CHILD_VARIANTS}
                  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
                  transition={{ ...TRANSITION_OPTIONS, delay: 0.25 }}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                >
                  <Form.Reset
                    size="medium"
                    variant="icon"
                    icon={CrossIcon}
                    aria-label={getText('cancelEdit')}
                    onPress={onCancel}
                    children={null}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Form.Provider>
    </form>
  )
}

/**
 * Props for {@link ErrorMessage}.
 */
interface ErrorMessageProps {
  readonly message: string
  readonly formRef: React.RefObject<HTMLFormElement>
}

/**
 * Error message for {@link EditableSpan}.
 */
function ErrorMessage(props: ErrorMessageProps) {
  const { message, formRef } = props

  const [measureFormRef, formRect] = useMeasure({ useRAF: false })

  const offset = 12
  const crossOffset = 36

  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  const outlineWidth = crossOffset + 10

  useLayoutEffect(() => {
    measureFormRef(formRef.current)
  }, [measureFormRef, formRef])

  return (
    <>
      {formRect && (
        <div
          className="pointer-events-none absolute rounded-4xl border-[2px] border-danger"
          style={{
            width: formRect.width + outlineWidth,
            height: formRect.height + offset,
            transform: `translateX(-${crossOffset}px)`,
          }}
        >
          <div className="absolute -bottom-0.5 -left-0.5 aspect-square w-5 [background:radial-gradient(circle_at_100%_0%,_transparent_70%,_var(--color-danger)_70%)]" />
        </div>
      )}

      <div
        className="absolute -bottom-[5px] left-0 z-1"
        style={{ transform: `translateX(-${crossOffset}px) translateY(100%)` }}
      >
        <Underlay className="max-w-[210px] rounded-2xl rounded-tl-none rounded-tr-none bg-danger px-2 py-1">
          <Text variant="body" truncate="3" color="invert" nowrap="normal">
            {message}
          </Text>

          <div className="absolute -top-[0.5px] right-[0.5px] aspect-square w-[21px] translate-x-full [background:radial-gradient(circle_at_100%_100%,_transparent_70%,_var(--color-danger)_70%)]" />
        </Underlay>
      </div>
    </>
  )
}
