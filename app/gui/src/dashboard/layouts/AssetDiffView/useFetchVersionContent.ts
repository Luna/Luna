/** @file Fetches the content of a project’s Main.enso file with specified version. */
import { queryOptions, useQuery } from '@tanstack/react-query'

import { splitFileContents } from 'ydoc-shared/ensoFile'

import type { Backend, ProjectId, S3ObjectVersionId } from '@common/services/Backend'

const TWO_MINUTES_MS = 120_000

/** Options for {@link useFetchVersionContent}. */
export interface FetchVersionContentOptions {
  readonly projectId: ProjectId
  readonly versionId?: S3ObjectVersionId
  readonly backend: Backend
  /** If `false`, the metadata is stripped out. Defaults to `false`. */
  readonly metadata?: boolean
}

/** Return the query options for fetching the content of a version. */
export function versionContentQueryOptions(params: FetchVersionContentOptions) {
  return queryOptions({
    queryKey: [
      params.backend.type,
      {
        method: 'getFileContent',
        versionId: params.versionId,
        projectId: params.projectId,
      },
    ] as const,
    queryFn: ({ queryKey }) => {
      const [, { method, versionId, projectId }] = queryKey
      return params.backend[method](projectId, versionId)
    },
    select: (data) => (params.metadata === true ? data : omitMetadata(data)),
    staleTime: TWO_MINUTES_MS,
  })
}

/** Fetch the content of a version. */
export function useFetchVersionContent(params: FetchVersionContentOptions) {
  return useQuery(versionContentQueryOptions(params))
}

/** Remove the metadata from the content of a version. */
function omitMetadata(file: string): string {
  return splitFileContents(file).code
}
