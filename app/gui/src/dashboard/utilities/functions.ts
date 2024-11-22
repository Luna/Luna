/** @file A collection of utilities that work with functions. */

/** A stable reference to a function that does nothing. */
// eslint-disable-next-line no-restricted-syntax, @typescript-eslint/no-explicit-any
export const noop: (...args: any[]) => void = () => {}
