/** @file Hooks to do batched backend operations. */
import { backendQueryOptions } from '#/hooks/backendHooks'
import { useToastAndLog } from '#/hooks/toastAndLogHooks'
import { useText } from '#/providers/TextProvider'
import { extractTypeAndId } from '#/services/LocalBackend'
import { download } from '#/utilities/download'
import { getMessageOrToString } from '#/utilities/error'
import {
  useMutation,
  useMutationState,
  useQueryClient,
  type DefaultError,
  type Mutation,
  type UseMutationOptions,
} from '@tanstack/react-query'
import {
  AssetType,
  BackendType,
  FilterBy,
  extractTypeFromId,
  type AssetId,
  type default as Backend,
  type DirectoryId,
  type LabelName,
} from 'enso-common/src/services/Backend'

/** An identity function to help in constructing options for a mutation. */
function mutationOptions<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
): UseMutationOptions<TData, TError, TVariables, TContext> {
  return options
}

/** Call "delete" mutations for a list of assets. */
export function deleteAssetsMutationOptions(backend: Backend) {
  return mutationOptions({
    mutationKey: [backend.type, 'deleteAssets'],
    mutationFn: async ([ids, force]: readonly [ids: readonly AssetId[], force: boolean]) => {
      const results = await Promise.allSettled(
        ids.map((id) => backend.deleteAsset(id, { force }, '(unknown)')),
      )
      const errors = results.flatMap((result): unknown =>
        result.status === 'rejected' ? [result.reason] : [],
      )
      if (errors.length !== 0) {
        throw Object.assign(new Error(errors.map(getMessageOrToString).join('\n')), {
          errors,
          failed: errors.length,
          total: ids.length,
        })
      }
      return null
    },
    meta: {
      invalidates: [
        [backend.type, 'listDirectory'],
        [backend.type, 'listAssetVersions'],
      ],
      awaitInvalidates: true,
    },
  })
}

/** The type of a "delete assets" mutation. */
type DeleteAssetsMutation = Mutation<
  null,
  Error,
  readonly [ids: readonly AssetId[], force: boolean]
>

/** Return matching in-flight "delete assets" mutations. */
export function useDeleteAssetsMutationState<Result>(
  backend: Backend,
  options: {
    predicate?: (mutation: DeleteAssetsMutation) => boolean
    select?: (mutation: DeleteAssetsMutation) => Result
  } = {},
) {
  const { predicate, select } = options
  return useMutationState({
    filters: {
      ...deleteAssetsMutationOptions(backend),
      predicate: (mutation: DeleteAssetsMutation) =>
        mutation.state.status === 'pending' && (predicate?.(mutation) ?? true),
    },
    // This is UNSAFE when the `Result` parameter is explicitly specified in the
    // generic parameter list.
    // eslint-disable-next-line no-restricted-syntax
    select: select as (mutation: Mutation<unknown, Error, unknown, unknown>) => Result,
  })
}

/** Call "restore" mutations for a list of assets. */
export function restoreAssetsMutationOptions(backend: Backend) {
  return mutationOptions({
    mutationKey: [backend.type, 'restoreAssets'],
    mutationFn: async (ids: readonly AssetId[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => backend.undoDeleteAsset(id, '(unknown)')),
      )
      const errors = results.flatMap((result): unknown =>
        result.status === 'rejected' ? [result.reason] : [],
      )
      if (errors.length !== 0) {
        throw Object.assign(new Error(errors.map(getMessageOrToString).join('\n')), {
          errors,
          failed: errors.length,
          total: ids.length,
        })
      }
      return null
    },
    meta: {
      invalidates: [[backend.type, 'listDirectory']],
      awaitInvalidates: true,
    },
  })
}

/** The type of a "restore assets" mutation. */
type RestoreAssetsMutation = Mutation<null, Error, readonly AssetId[]>

/** Return matching in-flight "restore assets" mutations. */
export function useRestoreAssetsMutationState<Result>(
  backend: Backend,
  options: {
    predicate?: (mutation: RestoreAssetsMutation) => boolean
    select?: (mutation: RestoreAssetsMutation) => Result
  } = {},
) {
  const { predicate, select } = options
  return useMutationState({
    filters: {
      ...restoreAssetsMutationOptions(backend),
      predicate: (mutation: RestoreAssetsMutation) =>
        mutation.state.status === 'pending' && (predicate?.(mutation) ?? true),
    },
    // This is UNSAFE when the `Result` parameter is explicitly specified in the
    // generic parameter list.
    // eslint-disable-next-line no-restricted-syntax
    select: select as (mutation: Mutation<unknown, Error, unknown, unknown>) => Result,
  })
}

/** Call "copy" mutations for a list of assets. */
export function copyAssetsMutationOptions(backend: Backend) {
  return mutationOptions({
    mutationKey: [backend.type, 'copyAssets'],
    mutationFn: async ([ids, parentId]: [ids: readonly AssetId[], parentId: DirectoryId]) => {
      const results = await Promise.allSettled(
        ids.map((id) => backend.copyAsset(id, parentId, '(unknown)', '(unknown)')),
      )
      const errors = results.flatMap((result): unknown =>
        result.status === 'rejected' ? [result.reason] : [],
      )
      if (errors.length !== 0) {
        throw Object.assign(new Error(errors.map(getMessageOrToString).join('\n')), {
          errors,
          failed: errors.length,
          total: ids.length,
        })
      }
      return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
    },
    meta: {
      invalidates: [[backend.type, 'listDirectory']],
      awaitInvalidates: true,
    },
  })
}

/** Call "move" mutations for a list of assets. */
export function moveAssetsMutationOptions(backend: Backend) {
  return mutationOptions({
    mutationKey: [backend.type, 'moveAssets'],
    mutationFn: async ([ids, parentId]: [ids: readonly AssetId[], parentId: DirectoryId]) => {
      const results = await Promise.allSettled(
        ids.map((id) =>
          backend.updateAsset(id, { description: null, parentDirectoryId: parentId }, '(unknown)'),
        ),
      )
      const errors = results.flatMap((result): unknown =>
        result.status === 'rejected' ? [result.reason] : [],
      )
      if (errors.length !== 0) {
        throw Object.assign(new Error(errors.map(getMessageOrToString).join('\n')), {
          errors,
          failed: errors.length,
          total: ids.length,
        })
      }
      return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
    },
    meta: {
      invalidates: [
        [backend.type, 'listDirectory'],
        [backend.type, 'listAssetVersions'],
      ],
      awaitInvalidates: true,
    },
  })
}

/** Clear the trash folder. */
export function useClearTrashMutation(backend: Backend) {
  const queryClient = useQueryClient()
  const deleteAssetsMutation = useMutation(deleteAssetsMutationOptions(backend))

  return useMutation({
    mutationKey: [backend.type, 'clearTrash'],
    mutationFn: async () => {
      const trashedItems = await queryClient.ensureQueryData(
        backendQueryOptions(backend, 'listDirectory', [
          {
            parentId: null,
            labels: null,
            filterBy: FilterBy.trashed,
            recentProjects: false,
          },
          '(unknown)',
        ]),
      )
      await deleteAssetsMutation.mutateAsync([trashedItems.map((item) => item.id), true])
      return null
    },
  })
}

/** Call "download" mutations for a list of assets. */
export function useDownloadAssetsMutation(backend: Backend) {
  return useMutation({
    mutationFn: async (infos: readonly { id: AssetId; title: string }[]) => {
      const results = await Promise.allSettled(
        infos.map(({ id, title }) => backend.download(id, title)),
      )
      const errors = results.flatMap((result): unknown =>
        result.status === 'rejected' ? [result.reason] : [],
      )
      if (errors.length !== 0) {
        throw Object.assign(new Error(errors.map(getMessageOrToString).join('\n')), {
          errors,
          failed: errors.length,
          total: infos.length,
        })
      }
      return null
    },
  })
}

/** Call "add label" mutations for a list of assets. */
export function addAssetsLabelsMutationOptions(backend: Backend) {
  return mutationOptions({
    mutationFn: async ([infos, labelNames]: [
      infos: readonly {
        id: AssetId
        labels: readonly LabelName[] | null
      }[],
      labelNames: readonly LabelName[],
    ]) => {
      const results = await Promise.allSettled(
        infos.map(async ({ id, labels }) => {
          const newLabels = [
            ...new Set([
              ...(labels ?? []),
              ...labelNames.filter((label) => labels?.includes(label) !== true),
            ]),
          ]
          if (newLabels.length !== labels?.length) {
            await backend.associateTag(id, newLabels, '(unknown)')
          }
        }),
      )
      const errors = results.flatMap((result): unknown =>
        result.status === 'rejected' ? [result.reason] : [],
      )
      if (errors.length !== 0) {
        throw Object.assign(new Error(errors.map(getMessageOrToString).join('\n')), {
          errors,
          failed: errors.length,
          total: infos.length,
        })
      }
      return null
    },
    meta: {
      invalidates: [[backend.type, 'listDirectory']],
      awaitInvalidates: true,
    },
  })
}

/** Call "remove label" mutations for a list of assets. */
export function removeAssetsLabelsMutationOptions(backend: Backend) {
  return mutationOptions({
    mutationFn: async ([infos, labelNames]: [
      infos: readonly {
        id: AssetId
        labels: readonly LabelName[] | null
      }[],
      labelNames: readonly LabelName[],
    ]) => {
      const results = await Promise.allSettled(
        infos.map(async ({ id, labels }) => {
          const labelNamesSet = new Set(labelNames)
          const newLabels = (labels ?? []).filter((label) => !labelNamesSet.has(label))
          if (labels && newLabels.length !== labels.length) {
            await backend.associateTag(id, newLabels, '(unknown)')
          }
        }),
      )
      const errors = results.flatMap((result): unknown =>
        result.status === 'rejected' ? [result.reason] : [],
      )
      if (errors.length !== 0) {
        throw Object.assign(new Error(errors.map(getMessageOrToString).join('\n')), {
          errors,
          failed: errors.length,
          total: infos.length,
        })
      }
      return null
    },
    meta: {
      invalidates: [[backend.type, 'listDirectory']],
      awaitInvalidates: true,
    },
  })
}
