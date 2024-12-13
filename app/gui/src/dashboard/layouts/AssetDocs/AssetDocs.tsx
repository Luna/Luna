/** @file Documentation display for an asset. */
import { useCallback } from 'react'

import type Backend from 'enso-common/src/services/Backend'
import { AssetType, type Asset } from 'enso-common/src/services/Backend'

import { MarkdownViewer } from '#/components/MarkdownViewer'
import { Result } from '#/components/Result'
import { useText } from '#/providers/TextProvider'
import { useStore } from '#/utilities/zustand'
import { useSuspenseQuery } from '@tanstack/react-query'
import { versionContentQueryOptions } from '../AssetDiffView/useFetchVersionContent'
import { assetPanelStore } from '../AssetPanel'

import { MutableFunctionDef, parseModule } from 'ydoc-shared/ast'
import { splitFileContents } from 'ydoc-shared/ensoFile'

/** Props for an {@link AssetDocs}. */
export interface AssetDocsProps {
  readonly backend: Backend
}

/** Documentation display for an asset. */
export function AssetDocs(props: AssetDocsProps) {
  const { backend } = props
  const { getText } = useText()

  const { item } = useStore(assetPanelStore, (state) => ({ item: state.assetPanelProps.item }), {
    unsafeEnableTransition: true,
  })

  if (item?.type !== AssetType.project) {
    return <Result status="info" title={getText('assetDocs.notProject')} centered />
  }

  return <AssetDocsContent backend={backend} item={item} />
}

/** Props for an {@link AssetDocsContent}. */
interface AssetDocsContentProps {
  readonly backend: Backend
  readonly item: Asset<AssetType.project>
}

/** Documentation display for an asset. */
export function AssetDocsContent(props: AssetDocsContentProps) {
  const { backend, item } = props
  const { getText } = useText()

  const { data: docs } = useSuspenseQuery({
    ...versionContentQueryOptions({ backend, projectId: item.id, metadata: false }),
    select: (data) => {
      const { code } = splitFileContents(data)
      const module = parseModule(code)

      for (const statement of module.statements()) {
        if (statement instanceof MutableFunctionDef && statement.name.code() === 'main') {
          return statement.mutableDocumentationMarkdown().toJSON()
        }
      }

      return ''
    },
  })

  const resolveProjectAssetPath = useCallback(
    (relativePath: string) => backend.resolveProjectAssetPath(item.id, relativePath),
    [backend, item.id],
  )

  if (!docs) {
    return <Result status="info" title={getText('assetDocs.noDocs')} centered />
  }

  return (
    <MarkdownViewer
      testId="asset-docs-content"
      text={docs}
      imgUrlResolver={resolveProjectAssetPath}
    />
  )
}
