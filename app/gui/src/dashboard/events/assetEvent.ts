/** @file Events related to changes in asset state. */
import type AssetEventType from '#/events/AssetEventType'

import type * as backend from '#/services/Backend'

/** Properties common to all asset state change events. */
interface AssetBaseEvent<Type extends AssetEventType> {
  readonly type: Type
}

/** All possible events. */
interface AssetEvents {
  readonly temporarilyAddLabels: AssetTemporarilyAddLabelsEvent
  readonly temporarilyRemoveLabels: AssetTemporarilyRemoveLabelsEvent
  readonly addLabels: AssetAddLabelsEvent
  readonly removeLabels: AssetRemoveLabelsEvent
}

/** A type to ensure that {@link AssetEvents} contains every {@link AssetEventType}. */
// This is meant only as a sanity check, so it is allowed to break lint rules.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type SanityCheck<
  T extends {
    readonly [Type in keyof typeof AssetEventType]: AssetBaseEvent<(typeof AssetEventType)[Type]>
  } = AssetEvents,
> = [T]

/** A signal to temporarily add labels to the selected assets. */
export interface AssetTemporarilyAddLabelsEvent
  extends AssetBaseEvent<AssetEventType.temporarilyAddLabels> {
  readonly ids: ReadonlySet<backend.AssetId>
  readonly labelNames: ReadonlySet<backend.LabelName>
}

/** A signal to temporarily remove labels from the selected assets. */
export interface AssetTemporarilyRemoveLabelsEvent
  extends AssetBaseEvent<AssetEventType.temporarilyRemoveLabels> {
  readonly ids: ReadonlySet<backend.AssetId>
  readonly labelNames: ReadonlySet<backend.LabelName>
}

/** A signal to add labels to the selected assets. */
export interface AssetAddLabelsEvent extends AssetBaseEvent<AssetEventType.addLabels> {
  readonly ids: ReadonlySet<backend.AssetId>
  readonly labelNames: ReadonlySet<backend.LabelName>
}

/** A signal to remove labels from the selected assets. */
export interface AssetRemoveLabelsEvent extends AssetBaseEvent<AssetEventType.removeLabels> {
  readonly ids: ReadonlySet<backend.AssetId>
  readonly labelNames: ReadonlySet<backend.LabelName>
}

/** Every possible type of asset event. */
export type AssetEvent = AssetEvents[keyof AssetEvents]
