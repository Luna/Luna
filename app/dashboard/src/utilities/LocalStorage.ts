/** @file A LocalStorage data manager. */
import type * as z from 'zod'

import * as common from 'enso-common'

import * as object from '#/utilities/object'

// ===============================
// === LocalStorageKeyMetadata ===
// ===============================

/** Metadata describing runtime behavior associated with a {@link LocalStorageKey}. */
export interface LocalStorageKeyMetadata<K extends LocalStorageKey> {
  readonly isUserSpecific?: boolean
  /**
   * The Zod schema to validate the value.
   * If this is provided, the value will be parsed using this schema.
   * If this is not provided, the value will be parsed using the `tryParse` function.
   */
  readonly schema: z.ZodType<LocalStorageData[K]>
}

// ========================
// === LocalStorageData ===
// ========================

/** The data that can be stored in a {@link LocalStorage}.
 * Declaration merge into this interface to add a new key. */
export interface LocalStorageData {}

// =======================
// === LocalStorageKey ===
// =======================

/** All possible keys of a {@link LocalStorage}. */
export type LocalStorageKey = keyof LocalStorageData

// ====================
// === LocalStorage ===
// ====================

/** A LocalStorage data manager. */
export default class LocalStorage {
  // This is UNSAFE. It is assumed that `LocalStorage.register` is always called
  // when `LocalStorageData` is declaration merged into.
  // eslint-disable-next-line no-restricted-syntax
  static keyMetadata = {} as Record<LocalStorageKey, LocalStorageKeyMetadata<LocalStorageKey>>
  localStorageKey = common.PRODUCT_NAME.toLowerCase()
  protected values: Partial<LocalStorageData>
  private readonly eventTarget = new EventTarget()

  /** Create a {@link LocalStorage}. */
  constructor() {
    const savedValues: unknown = JSON.parse(localStorage.getItem(this.localStorageKey) ?? '{}')
    const newValues: Partial<Record<LocalStorageKey, LocalStorageData[LocalStorageKey]>> = {}
    if (typeof savedValues === 'object' && savedValues != null) {
      for (const [key, metadata] of object.unsafeEntries(LocalStorage.keyMetadata)) {
        if (key in savedValues) {
          // This is SAFE, as it is guarded by the `key in savedValues` check.
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, no-restricted-syntax, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
          const savedValue = (savedValues as any)[key]
          const value = metadata.schema.safeParse(savedValue).data
          if (value != null) {
            newValues[key] = value
          }
        }
      }
    }
    // This is SAFE, as the `tryParse` function is required by definition to return a value of the
    // correct type for each corresponding key.
    // eslint-disable-next-line no-restricted-syntax, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    this.values = newValues as any
  }

  /** Register runtime behavior associated with a {@link LocalStorageKey}. */
  static registerKey<K extends LocalStorageKey>(key: K, metadata: LocalStorageKeyMetadata<K>) {
    LocalStorage.keyMetadata[key] = metadata
  }

  /** Retrieve an entry from the stored data. */
  get<K extends LocalStorageKey>(key: K) {
    return this.values[key]
  }

  /** Write an entry to the stored data, and save. */
  set<K extends LocalStorageKey>(key: K, value: LocalStorageData[K]) {
    this.values[key] = value
    this.eventTarget.dispatchEvent(new Event(key))
    this.save()
  }

  /** Delete an entry from the stored data, and save. */
  delete<K extends LocalStorageKey>(key: K) {
    const oldValue = this.values[key]
    // The key being deleted is one of a statically known set of keys.
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete this.values[key]
    this.eventTarget.dispatchEvent(new Event(key))
    this.save()
    return oldValue
  }

  /** Delete user-specific entries from the stored data, and save. */
  clearUserSpecificEntries() {
    for (const [key, metadata] of object.unsafeEntries(LocalStorage.keyMetadata)) {
      if (metadata.isUserSpecific === true) {
        this.delete(key)
      }
    }
  }

  /** Add an event listener to a specific key. */
  subscribe<K extends LocalStorageKey>(
    key: K,
    callback: (value: LocalStorageData[K] | undefined) => void,
  ) {
    const wrapped = () => {
      const value = this.values[key]
      callback(value)
    }
    this.eventTarget.addEventListener(key, wrapped)
    return () => {
      this.eventTarget.removeEventListener(key, wrapped)
    }
  }

  /** Save the current value of the stored data.. */
  protected save() {
    localStorage.setItem(this.localStorageKey, JSON.stringify(this.values))
  }
}
