/** @file A LocalStorage data manager. */
import invariant from 'tiny-invariant'

import { PRODUCT_NAME } from 'enso-common'
import { IS_DEV_MODE } from 'enso-common/src/detect'

import { unsafeEntries, unsafeKeys } from '#/utilities/object'

const KEY_DEFINITION_STACK_TRACES = new Map<string, string>()

/**
 * Whether the source location for `LocalStorage.defineKey(key, metadata)`
 * is different to the previous known source location.
 */
function isSourceChanged(key: string) {
  const stack = (new Error().stack ?? '').replace(/[?]t=\d+:\d+:\d+/g, '')
  const isChanged = stack !== KEY_DEFINITION_STACK_TRACES.get(key)
  KEY_DEFINITION_STACK_TRACES.set(key, stack)
  return isChanged
}

/** Metadata describing runtime behavior associated with a local storage key. */
export interface LocalStorageKeyMetadata {
  readonly isUserSpecific?: boolean
}

/** A LocalStorage data manager. */
export class LocalStorage {
  static keyMetadata: Record<string, LocalStorageKeyMetadata> = {}
  private static instance: LocalStorage | null = null
  localStorageKey = PRODUCT_NAME.toLowerCase()
  protected values: Record<string, unknown>
  private readonly eventTarget = new EventTarget()

  /** Create a {@link LocalStorage}. */
  private constructor() {
    this.values = {}
  }

  /** Get the singleton instance of {@link LocalStorage}. */
  static getInstance() {
    if (LocalStorage.instance == null) {
      LocalStorage.instance = new LocalStorage()
    }
    return LocalStorage.instance
  }

  /** Register metadata associated with a key. */
  static defineKey(key: string, metadata: LocalStorageKeyMetadata) {
    if (IS_DEV_MODE ? isSourceChanged(key) : true) {
      invariant(
        !(key in LocalStorage.keyMetadata),
        `Local storage key '${key}' has already been registered.`,
      )
    }
    LocalStorage.keyMetadata[key] = metadata
  }

  /** Get all registered keys. */
  static getAllKeys() {
    return unsafeKeys(LocalStorage.keyMetadata)
  }

  /** Retrieve an entry from the stored data. */
  get(key: string) {
    return this.values[key]
  }

  /** Write an entry to the stored data, and save. */
  set(key: string, value: unknown) {
    this.values[key] = value

    this.eventTarget.dispatchEvent(new Event(key))
    this.eventTarget.dispatchEvent(new Event('_change'))

    this.save()
  }

  /** Delete an entry from the stored data, and save. */
  delete(key: string) {
    const oldValue = this.values[key]
    // The key being deleted is one of a statically known set of keys.
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete this.values[key]
    this.eventTarget.dispatchEvent(new Event(key))
    this.eventTarget.dispatchEvent(new Event('_change'))
    this.save()

    return oldValue
  }

  /** Delete user-specific entries from the stored data, and save. */
  clearUserSpecificEntries() {
    for (const [key, metadata] of unsafeEntries(LocalStorage.keyMetadata)) {
      if (metadata.isUserSpecific === true) {
        this.delete(key)
      }
    }
  }

  /** Add an event listener to a specific key. */
  subscribe(key: string, callback: (value: unknown) => void) {
    const onChange = () => {
      callback(this.get(key))
    }
    this.eventTarget.addEventListener(key, onChange)

    return () => {
      this.eventTarget.removeEventListener(key, onChange)
    }
  }

  /** Add an event listener to all keys. */
  subscribeAll(callback: (value: Record<string, unknown>) => void) {
    const onChange = () => {
      callback(this.values)
    }
    this.eventTarget.addEventListener('_change', onChange)

    return () => {
      this.eventTarget.removeEventListener('_change', onChange)
    }
  }

  /** Save the current value of the stored data.. */
  protected save() {
    localStorage.setItem(this.localStorageKey, JSON.stringify(this.values))
  }
}
