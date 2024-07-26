/** @file Rendering for an arbitrary {@link SettingsEntryData}. */
import * as React from 'react'

import SettingsCustomEntry from './SettingsCustomEntry'
import type { SettingsContext, SettingsEntryData } from './settingsData'
import SettingsInputEntry from './SettingsInputEntry'

// =====================
// === SettingsEntry ===
// =====================

/** Props for a {@link SettingsEntry}. */
export interface SettingsEntryProps {
  readonly context: SettingsContext
  readonly data: SettingsEntryData
}

/** Rendering for an arbitrary {@link SettingsEntryData}. */
export default function SettingsEntry(props: SettingsEntryProps) {
  const { context, data } = props
  switch (data.type) {
    case 'input': {
      return <SettingsInputEntry context={context} data={data} />
    }
    case 'custom': {
      return <SettingsCustomEntry context={context} data={data} />
    }
  }
}
