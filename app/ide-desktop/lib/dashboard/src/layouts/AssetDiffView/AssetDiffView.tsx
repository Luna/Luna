/**
 * @file
 *
 * Diff view for 2 asset versions for a specific project
 */
import * as react from '@monaco-editor/react'

import Spinner, * as spinnerModule from '#/components/Spinner'

import type * as backendService from '#/services/Backend'
import type RemoteBackend from '#/services/RemoteBackend'

import * as useFetchVersionContent from './useFetchVersionContent'

/**
 * Props for the AssetDiffView component
 */
export interface AssetDiffViewProps {
  readonly versionId: string
  readonly latestVersionId: string
  readonly projectId: backendService.ProjectId
  readonly backend: RemoteBackend
}

/**
 * Diff view for asset versions
 */
export function AssetDiffView(props: AssetDiffViewProps) {
  const { versionId, projectId, backend, latestVersionId } = props

  const versionContent = useFetchVersionContent.useFetchVersionContent({
    versionId,
    projectId,
    backend,
  })
  const headContent = useFetchVersionContent.useFetchVersionContent({
    versionId: latestVersionId,
    projectId,
    backend,
  })

  const loader = (
    <div className="flex h-full w-full items-center justify-center">
      <Spinner size={32} state={spinnerModule.SpinnerState.loadingMedium} />
    </div>
  )

  if (versionContent.isError || headContent.isError) {
    return <div className="p-indent-8 text-center">Failed to load content</div>
  } else if (versionContent.isPending || headContent.isPending) {
    return loader
  } else {
    return (
      <react.DiffEditor
        beforeMount={monaco => {
          monaco.editor.defineTheme('myTheme', {
            base: 'vs',
            inherit: true,
            rules: [],
            // This comes from third-party code and we can't change it
            // eslint-disable-next-line @typescript-eslint/naming-convention
            colors: { 'editor.background': '#00000000' },
          })
        }}
        original={versionContent.data}
        modified={headContent.data}
        language="enso"
        options={{ readOnly: true }}
        loading={loader}
        theme={'myTheme'}
      />
    )
  }
}
