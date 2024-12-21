/** @file Diff view comparing `Main.enso` of two versions for a specific project. */
import { DiffEditor } from '@monaco-editor/react'
import { useSuspenseQueries } from '@tanstack/react-query'

import type { Backend, ProjectAsset, S3ObjectVersionId } from '@common/services/Backend'

import { StatelessSpinner } from '#/components/StatelessSpinner'
import { versionContentQueryOptions } from '#/layouts/AssetDiffView/useFetchVersionContent'

/** Props for an {@link AssetDiffView}. */
export interface AssetDiffViewProps {
  readonly versionId: S3ObjectVersionId
  readonly latestVersionId: S3ObjectVersionId
  readonly project: ProjectAsset
  readonly backend: Backend
}

/** Diff view comparing `Main.enso` of two versions for a specific project. */
export function AssetDiffView(props: AssetDiffViewProps) {
  const { versionId, project, backend, latestVersionId } = props

  const [versionContent, headContent] = useSuspenseQueries({
    queries: [
      versionContentQueryOptions({
        versionId,
        projectId: project.id,
        backend,
      }),
      versionContentQueryOptions({
        versionId: latestVersionId,
        projectId: project.id,
        backend,
      }),
    ],
  })

  const loader = (
    <div className="flex h-full w-full items-center justify-center">
      <StatelessSpinner size={32} state="loading-medium" />
    </div>
  )

  return (
    <DiffEditor
      beforeMount={(monaco) => {
        monaco.editor.defineTheme('myTheme', {
          base: 'vs',
          inherit: true,
          rules: [],
          // The name comes from a third-party API and cannot be changed.
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
