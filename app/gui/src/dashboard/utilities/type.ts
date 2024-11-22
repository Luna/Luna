/** @file General utility types. */

/** All types that are not functions. */
export type NonFunction = bigint | boolean | number | object | string | symbol | null | undefined

/** Whether the given value is a function. */
export function isFunction(value: unknown): value is (...args: never) => unknown {
  return typeof value === 'function'
}
