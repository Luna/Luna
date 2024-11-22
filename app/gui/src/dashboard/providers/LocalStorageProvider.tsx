/** @file Provider for type-safely storing state in `localStorage`. */
import {
  createContext,
  type PropsWithChildren,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { z } from 'zod'

import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { LocalStorage, type LocalStorageKeyMetadata } from '#/utilities/LocalStorage'
import { isFunction, type NonFunction } from '#/utilities/type'

/** State contained in a `LocalStorageContext`. */
export interface LocalStorageContextType {
  readonly localStorage: LocalStorage
}

// @ts-expect-error The default value will never be exposed, as using this without a `Provider`
// is a mistake.
const LocalStorageContext = createContext<LocalStorageContextType>(null)

/** Props for a {@link LocalStorageProvider}. */
export type LocalStorageProviderProps = Readonly<PropsWithChildren>

/** A React Provider that lets components get the shortcut registry. */
export default function LocalStorageProvider(props: LocalStorageProviderProps) {
  const { children } = props

  const localStorage = useMemo(() => LocalStorage.getInstance(), [])

  return (
    <LocalStorageContext.Provider value={{ localStorage }}>{children}</LocalStorageContext.Provider>
  )
}

/** Exposes a property to get the shortcut registry. */
export function useLocalStorage() {
  return useContext(LocalStorageContext)
}

/** Options for {@link defineLocalStorageKey}. */
export interface DefineLocalStorageKeyOptions<Schema extends z.ZodSchema>
  extends LocalStorageKeyMetadata {
  readonly schema: (zod: typeof z) => Schema
}

/** Create a set of hooks for interacting with one specific local storage key. */
export function defineLocalStorageKey<Schema extends z.ZodSchema>(
  key: string,
  options: DefineLocalStorageKeyOptions<Schema>,
) {
  /** The type of the value corresponding to this {@link LocalStorage} key. */
  type Value = NonFunction & z.infer<Schema>

  const { schema: makeSchema, ...metadata } = options
  const schema = makeSchema(z)
  LocalStorage.defineKey(key, metadata)

  if ('error' in schema.safeParse(LocalStorage.getInstance().get(key))) {
    LocalStorage.getInstance().delete(key)
  }

  const get = (localStorage: LocalStorage = LocalStorage.getInstance()) => {
    // eslint-disable-next-line no-restricted-syntax, @typescript-eslint/no-unsafe-return
    return localStorage.get(key) as Value | undefined
  }

  const set = (value: Value, localStorage: LocalStorage = LocalStorage.getInstance()) => {
    localStorage.set(key, value)
  }

  const useGet = () => {
    const { localStorage } = useLocalStorage()

    useEffect(() => {
      if ('error' in schema.safeParse(localStorage.get(key))) {
        localStorage.delete(key)
      }
    }, [localStorage])

    // The return type is not `any`, this is a bug in ESLint.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return useEventCallback(() => get(localStorage))
  }

  const useSet = () => {
    const { localStorage } = useLocalStorage()

    return useEventCallback((value: Value) => {
      set(value, localStorage)
    })
  }

  function useLocalStorageState(): readonly [
    value: Value | undefined,
    setValue: (newValue: SetStateAction<Value | undefined>) => void,
  ]
  function useLocalStorageState(
    defaultValue: Value,
  ): readonly [value: Value, setValue: (newValue: SetStateAction<Value>) => void]
  /** Subscribe to Local Storage updates for a specific key. */
  // eslint-disable-next-line no-restricted-syntax
  function useLocalStorageState(
    defaultValue?: Value,
  ): readonly [
    value: Value | undefined,
    setValue: (newValue: SetStateAction<Value | undefined>) => void,
  ] {
    const { localStorage } = useLocalStorage()

    const [value, privateSetValue] = useState<Value | undefined>(
      () => get(localStorage) ?? defaultValue,
    )

    const setValue = useEventCallback((newValue: SetStateAction<Value | undefined>) => {
      privateSetValue((currentValue) => {
        const nextValue = isFunction(newValue) ? newValue(currentValue) : newValue
        if (nextValue === undefined) {
          localStorage.delete(key)
        } else {
          localStorage.set(key, nextValue)
        }
        return nextValue
      })
    })

    return [value, setValue]
  }
  return { get, set, useGet, useSet, useState: useLocalStorageState }
}
