/**
 * @file The React provider for localStorage, along with hooks to use the provider
 * via the shared React context.
 */
import * as React from 'react'

import { useEventCallback } from '#/hooks/eventCallbackHooks'

import LocalStorage, { type LocalStorageData, type LocalStorageKey } from '#/utilities/LocalStorage'

// ===========================
// === LocalStorageContext ===
// ===========================

/** State contained in a `LocalStorageContext`. */
export interface LocalStorageContextType {
  readonly localStorage: LocalStorage
}

// @ts-expect-error The default value will never be exposed, as using this without a `Provider`
// is a mistake.
const LocalStorageContext = React.createContext<LocalStorageContextType>(null)

/** Props for a {@link LocalStorageProvider}. */
export type LocalStorageProviderProps = Readonly<React.PropsWithChildren>

// ============================
// === LocalStorageProvider ===
// ============================

/** A React Provider that lets components get the shortcut registry. */
export default function LocalStorageProvider(props: LocalStorageProviderProps) {
  const { children } = props

  const localStorage = React.useMemo(() => LocalStorage.getInstance(), [])

  return (
    <LocalStorageContext.Provider value={{ localStorage }}>{children}</LocalStorageContext.Provider>
  )
}

/** Exposes a property to get the shortcut registry. */
export function useLocalStorage() {
  return React.useContext(LocalStorageContext)
}

export function useLocalStorageState<K extends LocalStorageKey>(
  key: K,
): readonly [
  value: LocalStorageData[K] | undefined,
  setValue: (newValue: React.SetStateAction<LocalStorageData[K] | undefined>) => void,
]

export function useLocalStorageState<K extends LocalStorageKey>(
  key: K,
  defaultValue: LocalStorageData[K],
): readonly [
  value: LocalStorageData[K],
  setValue: (newValue: React.SetStateAction<LocalStorageData[K]>) => void,
]

/** Subscribe to Local Storage updates for a specific key. */
export function useLocalStorageState<K extends LocalStorageKey>(
  key: K,
  defaultValue?: LocalStorageData[K],
): readonly [
  value: LocalStorageData[K] | undefined,
  setValue: (newValue: LocalStorageData[K] | undefined) => void,
] {
  const { localStorage } = useLocalStorage()

  const [value, privateSetValue] = React.useState<LocalStorageData[K] | undefined>(
    () => localStorage.get(key) ?? defaultValue,
  )

  const setValue = useEventCallback(
    (newValue: React.SetStateAction<LocalStorageData[K] | undefined>) => {
      privateSetValue((currentValue) => {
        const nextValue = typeof newValue === 'function' ? newValue(currentValue) : newValue

        if (nextValue === undefined) {
          localStorage.delete(key)
        } else {
          localStorage.set(key, nextValue)
        }

        return nextValue
      })
    },
  )

  React.useEffect(
    () =>
      localStorage.subscribe(key, (newValue) => {
        privateSetValue(newValue ?? defaultValue)
      }),
    [defaultValue, key, localStorage],
  )

  return [value, setValue]
}

/**
 * A hook to toggle a value in Local Storage.
 * @param key - The key to toggle.
 * @param defaultValue - The default value.
 * @returns An array with the current value and a function to toggle the value.
 */
export function useLocalStorageToggle<Key extends LocalStorageKey>(
  key: Key,
  defaultValue: LocalStorageData[Key] extends boolean ? LocalStorageData[Key] : never,
) {
  const [value, setValue] = useLocalStorageState(key, defaultValue)

  const toggle = useEventCallback(() => {
    setValue((currentValue) => !currentValue)
  })

  return [value, toggle] as const
}
