/** @file Rendering for a settings section. */
import * as React from 'react'

import * as tailwindMerge from 'tailwind-merge'

import type * as settingsData from '#/layouts/Settings/settingsData'
import SettingsSection from '#/layouts/Settings/SettingsSection'

import * as errorBoundary from '#/components/ErrorBoundary'
import * as loader from '#/components/Loader'

// ===================
// === SettingsTab ===
// ===================

/** Props for a {@link SettingsTab}. */
export interface SettingsTabProps {
  readonly context: settingsData.SettingsContext
  readonly data: settingsData.SettingsTabData
}

/** Styled content of a settings tab. */
export default function SettingsTab(props: SettingsTabProps) {
  const { context, data } = props
  const { sections } = data
  const [columns, classes] = React.useMemo<
    [readonly (readonly settingsData.SettingsSectionData[])[], readonly string[]]
  >(() => {
    const resultColumns: settingsData.SettingsSectionData[][] = []
    const resultClasses: string[] = []
    for (const section of sections) {
      const columnNumber = section.column ?? 1
      while (resultColumns.length < columnNumber) {
        resultColumns.push([])
      }
      resultColumns[columnNumber - 1]?.push(section)
      while (resultClasses.length < columnNumber) {
        resultClasses.push('')
      }
      if (section.columnClassName != null) {
        const oldClasses = resultClasses[columnNumber - 1]
        resultClasses[columnNumber - 1] =
          oldClasses == null ? section.columnClassName : `${oldClasses} ${section.columnClassName}`
      }
    }
    return [resultColumns, resultClasses]
  }, [sections])

  const content =
    columns.length === 1 ? (
      <div className="flex grow flex-col gap-settings-subsection overflow-auto">
        {sections.map(section => (
          <SettingsSection key={section.nameId} context={context} data={section} />
        ))}
      </div>
    ) : (
      <div className="flex min-h-full grow flex-col gap-settings-section overflow-auto lg:h-auto lg:flex-row">
        {columns.map((sectionsInColumn, i) => (
          <div
            key={i}
            className={tailwindMerge.twMerge(
              'flex min-w-settings-main-section flex-col gap-settings-subsection',
              classes[i]
            )}
          >
            {sectionsInColumn.map(section => (
              <SettingsSection key={section.nameId} context={context} data={section} />
            ))}
          </div>
        ))}
      </div>
    )

  return (
    <errorBoundary.ErrorBoundary>
      <React.Suspense fallback={<loader.Loader size="medium" minHeight="h64" />}>
        <main className="h-full w-full flex-shrink-0 flex-grow basis-0 overflow-y-auto overflow-x-hidden pb-12 pl-1.5 pr-3">
          <div className="w-full max-w-[840px]">{content}</div>
        </main>
      </React.Suspense>
    </errorBoundary.ErrorBoundary>
  )
}
