/**
 * @file
 *
 * Suspense is a component that allows you to wrap a part of your application that might suspend,
 * showing a fallback to the user while waiting for the data to load.
 */

import * as React from 'react'

import { useIsFetching } from '@tanstack/react-query'

import { Result, type ResultProps } from '#/components/Result'
import { useDebounceValue } from '#/hooks/debounceValueHooks'
import { useOffline } from '#/hooks/offlineHooks'
import { useText } from '#/providers/TextProvider'
import * as loader from './Loader'

/** Props for {@link Suspense} component. */
export interface SuspenseProps extends React.SuspenseProps {
  readonly loaderProps?: loader.LoaderProps
  readonly offlineFallback?: React.ReactNode
  readonly offlineFallbackProps?: ResultProps
}

const OFFLINE_FETCHING_TOGGLE_DELAY_MS = 250

/**
 * Suspense is a component that allows you to wrap a part of your application that might suspend,
 * showing a fallback to the user while waiting for the data to load.
 *
 * Unlike the React.Suspense component, this component does not require a fallback prop.
 * And handles offline scenarios.
 */
export function Suspense(props: SuspenseProps) {
  const { children, loaderProps, fallback, offlineFallback, offlineFallbackProps } = props

  return (
    <React.Suspense
      fallback={
        <Loader
          {...loaderProps}
          fallback={fallback}
          offlineFallback={offlineFallback}
          offlineFallbackProps={offlineFallbackProps}
        />
      }
    >
      {children}
    </React.Suspense>
  )
}

/**
 * Props for {@link Loader} component.
 */
interface LoaderProps extends loader.LoaderProps {
  readonly fallback?: SuspenseProps['fallback']
  readonly offlineFallback?: SuspenseProps['offlineFallback']
  readonly offlineFallbackProps?: SuspenseProps['offlineFallbackProps']
}

/**
 * Fallback Element
 * Checks if ongoing network requests are happening
 * And shows either fallback(loader) or offline message
 *
 * Some request do not require active internet connection, e.g. requests to the local backend
 * So we don't want to show misleading information
 *
 * We check the fetching status in fallback component because
 * we want to know if there are ongoing requests once React renders the fallback in suspense
 */
export function Loader(props: LoaderProps) {
  const { fallback, offlineFallbackProps, offlineFallback, ...loaderProps } = props

  const { getText } = useText()

  const { isOffline } = useOffline()

  const paused = useIsFetching({ fetchStatus: 'paused' })

  const fetching = useIsFetching({
    predicate: (query) =>
      query.state.fetchStatus === 'fetching' ||
      query.state.status === 'pending' ||
      query.state.status === 'success',
  })

  // we use small debounce to avoid flickering when query is resolved,
  // but fallback is still showing
  const shouldDisplayOfflineMessage = useDebounceValue(
    isOffline && paused >= 0 && fetching === 0,
    OFFLINE_FETCHING_TOGGLE_DELAY_MS,
  )

  if (shouldDisplayOfflineMessage) {
    return (
      offlineFallback ?? (
        <Result status="info" title={getText('offlineTitle')} {...offlineFallbackProps} />
      )
    )
  } else {
    return fallback ?? <loader.Loader minHeight="h24" size="medium" {...loaderProps} />
  }
}
