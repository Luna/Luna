/**
 * @file
 *
 * A collection of hooks to toggle a boolean value.
 */
import { useState } from 'react'
import invariant from 'tiny-invariant'
import { useEventCallback } from './eventCallbackHooks'

/**
 * A hook to toggle a boolean value.
 * @returns An object with the current state and a function to toggle the state.
 */
export function useToggle(initialValue: boolean | (() => boolean) = false) {
  const [isOpen, setIsOpen] = useState(initialValue)

  const toggle = useEventCallback(() => {
    setIsOpen((prev) => !prev)
  })

  return [isOpen, toggle] as const
}

/**
 * A hook to switch between arbitrary values.
 * @param values - The values to switch between.
 * @param intitialIndex - The index of the initial value.
 * @returns An array with the current value and a function to switch to the next value.
 */
export function useSwitch<T>(values: T[], intitialIndex: number = 0) {
  const initialValue = values[intitialIndex]

  invariant(initialValue != null, 'Initial index out of bounds')

  const [value, setValue] = useState<T>(initialValue)

  const switchToNext = useEventCallback(() => {
    const nextIndex = (values.indexOf(value) + 1) % values.length
    const nextValue = values[nextIndex]

    // This should never happen, but it's a sanity check.
    invariant(nextValue != null, 'Next index out of bounds')

    setValue(nextValue)
  })

  return [value, switchToNext] as const
}
