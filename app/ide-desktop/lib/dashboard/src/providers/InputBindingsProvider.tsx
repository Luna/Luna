/** @file The React provider for keyboard and mouse shortcutManager, along with hooks to use the provider
 * via the shared React context. */
import * as React from 'react'

import * as inputBindingsModule from '#/configurations/inputBindings'

// ============================
// === InputBindingsContext ===
// ============================

/** State contained in a `ShortcutsContext`. */
export interface InputBindingsContextType extends inputBindingsModule.DashboardBindingNamespace {}

const InputBindingsContext = React.createContext<InputBindingsContextType>(
  inputBindingsModule.createBindings()
)

/** Props for a {@link InputBindingsProvider}. */
export interface InputBindingsProviderProps extends React.PropsWithChildren<object> {
  readonly inputBindings?: inputBindingsModule.DashboardBindingNamespace
}

// =============================
// === InputBindingsProvider ===
// =============================

/** A React Provider that lets components get the shortcut registry. */
export default function InputBindingsProvider(props: InputBindingsProviderProps) {
  const { inputBindings: inputBindingsRaw, children } = props
  const [inputBindings, setInputBindings] = React.useState(
    () => inputBindingsRaw ?? inputBindingsModule.createBindings()
  )

  React.useEffect(() => {
    setInputBindings(inputBindingsRaw ?? inputBindingsModule.createBindings())
  }, [inputBindingsRaw])

  return (
    <InputBindingsContext.Provider value={inputBindings}>{children}</InputBindingsContext.Provider>
  )
}

/** Exposes a property to get the input bindings namespace. */
export function useInputBindings() {
  return React.useContext(InputBindingsContext)
}
