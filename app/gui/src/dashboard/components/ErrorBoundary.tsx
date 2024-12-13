/** @file Catches errors in child components. */
import type { JSX, PropsWithChildren } from 'react'

import { captureException } from '@sentry/react'
import { QueryErrorResetBoundary } from '@tanstack/react-query'
import {
  ErrorBoundary as ReactErrorBoundary,
  type FallbackProps,
  type ErrorBoundaryProps as ReactErrorBoundaryProps,
} from 'react-error-boundary'

import { IS_DEV_MODE } from 'enso-common/src/detect'
import { getMessageOrToString, tryGetStack } from 'enso-common/src/utilities/error'

import { Alert, Button, ButtonGroup, Separator, Text } from '#/components/AriaComponents'
import { Result, type ResultProps } from '#/components/Result'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { useOffline } from '#/hooks/offlineHooks'
import { useText } from '#/providers/TextProvider'

/** Arguments for the {@link ErrorBoundaryProps.onBeforeFallbackShown} callback. */
export interface OnBeforeFallbackShownArgs {
  readonly error: unknown
  readonly resetErrorBoundary: () => void
  readonly resetQueries: () => void
}

/** Props for an {@link ErrorBoundary}. */
export interface ErrorBoundaryProps
  extends Readonly<PropsWithChildren>,
    Readonly<
      Pick<ReactErrorBoundaryProps, 'FallbackComponent' | 'onError' | 'onReset' | 'resetKeys'>
    > {
  /** Called before the fallback is shown. */
  readonly onBeforeFallbackShown?: (args: OnBeforeFallbackShownArgs) => void
  readonly title?: string
  readonly subtitle?: string
}

/**
 * Catches errors in child components
 * Shows a fallback UI when there is an error.
 * The error can also be logged to an error reporting service.
 */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  const {
    FallbackComponent = ErrorDisplay,
    onError = () => {},
    onReset = () => {},
    onBeforeFallbackShown = () => {},
    title,
    subtitle,
    ...rest
  } = props

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ReactErrorBoundary
          FallbackComponent={(fallbackProps) => (
            <FallbackComponent
              {...fallbackProps}
              onBeforeFallbackShown={onBeforeFallbackShown}
              resetQueries={reset}
              title={title}
              subtitle={subtitle}
            />
          )}
          onError={(error, info) => {
            captureException(error, { extra: { info } })
            onError(error, info)
          }}
          onReset={(details) => {
            reset()
            onReset(details)
          }}
          {...rest}
        />
      )}
    </QueryErrorResetBoundary>
  )
}

/** Props for a {@link ErrorDisplay}. */
export interface ErrorDisplayProps extends FallbackProps {
  readonly status?: ResultProps['status']
  readonly onBeforeFallbackShown?: (args: OnBeforeFallbackShownArgs) => void
  readonly resetQueries?: () => void
  readonly title?: string | undefined
  readonly subtitle?: string | undefined
  readonly error: unknown
}

/** Default fallback component to show when there is an error. */
export function ErrorDisplay(props: ErrorDisplayProps): JSX.Element {
  const { getText } = useText()
  const { isOffline } = useOffline()

  const {
    error,
    resetErrorBoundary,
    title = getText('somethingWentWrong'),
    subtitle = isOffline ? getText('offlineErrorMessage') : getText('arbitraryErrorSubtitle'),
    status = isOffline ? 'info' : 'error',
    onBeforeFallbackShown,
    resetQueries = () => {},
  } = props

  const message = getMessageOrToString(error)
  const stack = tryGetStack(error)

  onBeforeFallbackShown?.({ error, resetErrorBoundary, resetQueries })

  const onReset = useEventCallback(() => {
    resetErrorBoundary()
  })

  return (
    <Result className="h-full" status={status} title={title} subtitle={subtitle}>
      <ButtonGroup align="center">
        <Button variant="submit" size="small" rounded="full" className="w-24" onPress={onReset}>
          {getText('tryAgain')}
        </Button>
      </ButtonGroup>

      {IS_DEV_MODE && stack != null && (
        <div className="mt-6">
          <Separator className="my-2" />

          <Text color="primary" variant="h1" className="text-start">
            {getText('developerInfo')}
          </Text>

          <Text color="danger" variant="body">
            {getText('errorColon')}
            {message}
          </Text>

          <Alert
            className="mx-auto mt-2 max-h-[80vh] max-w-screen-lg overflow-auto"
            variant="neutral"
          >
            <Text
              elementType="pre"
              className="whitespace-pre-wrap text-left"
              color="primary"
              variant="body"
            >
              {stack}
            </Text>
          </Alert>
        </div>
      )}
    </Result>
  )
}

export { useErrorBoundary, withErrorBoundary } from 'react-error-boundary'
