/** @file A collection of utilities that work with functions. */

/** A stable reference to a function that does nothing. */
// eslint-disable-next-line no-restricted-syntax
export const noop: (...args: never) => void = () => {}
