/**
 * @file
 *
 * React Query client for the dashboard.
 */

import * as persistClientCore from '@tanstack/query-persist-client-core'
import * as reactQuery from '@tanstack/react-query'
import * as idbKeyval from 'idb-keyval'

declare module '@tanstack/react-query' {
  /**
   * React Query client with additional methods.
   */
  interface QueryClient {
    /**
     * Clear the cache stored in React Query and the persister storage.
     * Please use this method with caution, as it will clear all cache data.
     * Usually you should use `queryClient.invalidateQueries` instead.
     */
    readonly clearWithPersister: () => Promise<void>
    /**
     * Clear the cache stored in the persister storage.
     */
    readonly nukePersister: () => Promise<void>
  }
  /**
   * Specifies the invalidation behavior of a mutation.
   */
  interface Register {
    readonly mutationMeta: {
      /**
       * List of query keys to invalidate when the mutation succeeds.
       */
      readonly invalidates?: reactQuery.QueryKey[]
      /**
       * List of query keys to await invalidation before the mutation is considered successful.
       *
       * If `true`, all `invalidates` are awaited.
       *
       * If `false`, no invalidations are awaited.
       *
       * You can also provide an array of query keys to await.
       *
       * Queries that are not listed in invalidates will be ignored.
       * @default false
       */
      readonly awaitInvalidates?: reactQuery.QueryKey[] | boolean
    }

    readonly queryMeta: {
      /**
       * Whether to persist the query cache in the storage. Defaults to `true`.
       * Use `false` to disable persistence for a specific query, for example for
       * a sensitive data or data that can't be persisted, e.g. class instances.
       * @default true
       */
      readonly persist?: boolean
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-magic-numbers
const DEFAULT_QUERY_STALE_TIME_MS = 2 * 60 * 1000
// eslint-disable-next-line @typescript-eslint/no-magic-numbers
const DEFAULT_QUERY_PERSIST_TIME_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

const DEFAULT_BUSTER = 'v1.1'

/**
 * Create a new React Query client.
 */
export function createReactQueryClient() {
  const store = idbKeyval.createStore('enso', 'query-persist-cache')
  reactQuery.onlineManager.setOnline(navigator.onLine)

  const persister = persistClientCore.experimental_createPersister({
    storage: {
      getItem: key => idbKeyval.get<persistClientCore.PersistedQuery>(key, store),
      setItem: (key, value) => idbKeyval.set(key, value, store),
      removeItem: key => idbKeyval.del(key, store),
    },
    // Prefer online first and don't rely on the local cache if user is online
    // fallback to the local cache only if the user is offline
    maxAge: reactQuery.onlineManager.isOnline() ? -1 : DEFAULT_QUERY_PERSIST_TIME_MS,
    buster: DEFAULT_BUSTER,
    filters: { predicate: query => query.meta?.persist !== false },
    prefix: 'enso:query-persist:',
    serialize: persistedQuery => persistedQuery,
    deserialize: persistedQuery => persistedQuery,
  })

  const queryClient: reactQuery.QueryClient = new reactQuery.QueryClient({
    mutationCache: new reactQuery.MutationCache({
      onSuccess: (_data, _variables, _context, mutation) => {
        const shouldAwaitInvalidates = mutation.meta?.awaitInvalidates ?? false
        const invalidates = mutation.meta?.invalidates ?? []
        const invalidatesToAwait = (() => {
          if (Array.isArray(shouldAwaitInvalidates)) {
            return shouldAwaitInvalidates
          } else {
            return shouldAwaitInvalidates ? invalidates : []
          }
        })()
        const invalidatesToIgnore = invalidates.filter(
          queryKey => !invalidatesToAwait.includes(queryKey)
        )

        for (const queryKey of invalidatesToIgnore) {
          void queryClient.invalidateQueries({
            predicate: query => reactQuery.matchQuery({ queryKey }, query),
          })
        }

        if (invalidatesToAwait.length > 0) {
          // eslint-disable-next-line no-restricted-syntax
          return Promise.all(
            invalidatesToAwait.map(queryKey =>
              queryClient.invalidateQueries({
                predicate: query => reactQuery.matchQuery({ queryKey }, query),
              })
            )
          )
        }
      },
    }),
    defaultOptions: {
      queries: {
        persister,
        refetchOnReconnect: 'always',
        staleTime: DEFAULT_QUERY_STALE_TIME_MS,
        retry: (failureCount, error: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-magic-numbers
          const statusesToIgnore = [401, 403, 404]
          const errorStatus =
            typeof error === 'object' &&
            error != null &&
            'status' in error &&
            typeof error.status === 'number'
              ? error.status
              : -1

          if (statusesToIgnore.includes(errorStatus)) {
            return false
          } else {
            return failureCount < 3
          }
        },
      },
    },
  })

  Object.defineProperty(queryClient, 'nukePersister', {
    value: () => idbKeyval.clear(store),
    enumerable: false,
    configurable: false,
    writable: false,
  })

  Object.defineProperty(queryClient, 'clearWithPersister', {
    value: () => {
      queryClient.clear()
      return queryClient.nukePersister()
    },
    enumerable: false,
    configurable: false,
    writable: false,
  })

  return queryClient
}
