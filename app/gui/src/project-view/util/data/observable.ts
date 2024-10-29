/** Functions for querying {@link ObservableV2}s. */

import type { ObservableV2 } from 'lib0/observable'

/** Possible events which can be emitted by Observable. */
export type Events<O extends ObservableV2<any>> = O extends ObservableV2<infer E> ? E : never
/** A list of all possible events of the observable, in fixed (but unspecified) order. */
export type ListOfEvents<O extends ObservableV2<any>> = TupleFromUnion<keyof Events<O>>

type TupleFromUnion<T, L = LastOf<T>, N = [T] extends [never] ? true : false> =
  true extends N ? [] : [...TupleFromUnion<Exclude<T, L>>, L]
type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never
type LastOf<T> =
  UnionToIntersection<T extends any ? (x: T) => void : never> extends (x: infer L) => void ? L
  : never

/**
 * Returns promise which will resolve on the next event. The promise will have the event's
 * payload.
 */
export function nextEvent<O extends ObservableV2<any>, NAME extends string>(
  observable: O,
  event: NAME,
): Promise<Parameters<Events<O>[NAME]>> {
  type Params = Parameters<Events<O>[NAME]>
  return new Promise<Params>((resolve) => {
    observable.once(event, (...args: Params) => {
      resolve(args)
    })
  })
}

declare const EVENTS_BRAND: unique symbol
declare module 'lib0/observable' {
  interface ObservableV2<EVENTS extends { [key in keyof EVENTS]: (...arg0: any[]) => void }> {
    [EVENTS_BRAND]: EVENTS
  }
}
