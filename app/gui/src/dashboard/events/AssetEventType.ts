/** @file Possible types of asset state change. */

/** Possible types of asset state change. */
enum AssetEventType {
  download = 'download',
  downloadSelected = 'download-selected',
  temporarilyAddLabels = 'temporarily-add-labels',
  temporarilyRemoveLabels = 'temporarily-remove-labels',
  addLabels = 'add-labels',
  removeLabels = 'remove-labels',
}

export default AssetEventType
