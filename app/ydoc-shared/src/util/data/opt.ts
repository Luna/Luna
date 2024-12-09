/** @file A value that may be `null` or `undefined`. */

/**
 * Optional value type. This is a replacement for `T | null | undefined` that is more
 * convenient to use. We do not select a single value to represent "no value", because we are using
 * libraries that disagree whether `null` (e.g. Yjs) or `undefined` (e.g. Vue) should be used for
 * that purpose. We want to be compatible with both without needless conversions. In our own code,
 * we should return `undefined` for "no value", since that is the default value for empty or no
 * `return` expression. In order to test whether an `Opt<T>` is defined or not, use `x == null` or
 * `isSome` function.
 *
 * Note: For JSON-serialized data, prefer explicit `null` over `undefined`, since `undefined` is
 * not serializable. Alternatively, use optional field syntax (e.g. `{ x?: number }`).
 */
export type Opt<T> = T | null | undefined

/** Whether the given {@link Opt} is non-nullish. */
export function isSome<T>(value: Opt<T>): value is T {
  return value != null
}

/** Whether the given {@link Opt} is nullish. */
export function isNone(value: Opt<any>): value is null | undefined {
  return value == null
}

/**
 * Map the value inside the given {@link Opt} if it is not nullish,
 * else return the given fallback value.
 */
export function mapOr<T, R>(optional: Opt<T>, fallback: R, mapper: (value: T) => R): R {
  return isSome(optional) ? mapper(optional) : fallback
}

/**
 * Map the value inside the given {@link Opt} if it is not nullish,
 * else return undefined.
 */
export function mapOrUndefined<T, R>(optional: Opt<T>, mapper: (value: T) => Opt<R>): Opt<R> {
  return mapOr(optional, undefined, mapper)
}
