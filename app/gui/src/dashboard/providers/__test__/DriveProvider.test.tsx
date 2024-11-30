/**
 * @file Tests for {@link DriveProvider}
 */
import type { Category } from '#/layouts/CategorySwitcher/Category'
import { act, renderHook, type RenderHookOptions, type RenderHookResult, waitFor } from '#/test'
import { describe, expect, it } from 'vitest'
import { DirectoryId } from '../../services/Backend'
import DriveProvider, {
  useExpandedDirectoryIds,
  useSetCategory,
  useSetExpandedDirectoryIds,
} from '../DriveProvider'

/**
 * A custom renderHook function for tests that provides the {@link DriveProvider} context.
 */
function renderDriveProviderHook<Result, Props>(
  hook: (props: Props) => Result,
  options?: Omit<RenderHookOptions<Props>, 'wrapper'>,
): RenderHookResult<Result, Props> {
  return renderHook(hook, { wrapper: DriveProvider, ...options })
}

describe('DriveProvider', () => {
  it('Should reset expanded directory ids when category changes', async () => {
    const setCategory = renderDriveProviderHook(() => useSetCategory())
    const setExpandedDirectoryIds = renderDriveProviderHook(() => useSetExpandedDirectoryIds())
    const expandedDirectoryIds = renderDriveProviderHook(() => useExpandedDirectoryIds())

    act(() => {
      setExpandedDirectoryIds.result.current([DirectoryId('test-123')])
    })

    await waitFor(() => {
      expect(expandedDirectoryIds.result.current).toEqual([DirectoryId('test-123')])
    })

    act(() => {
      // eslint-disable-next-line no-restricted-syntax
      setCategory.result.current({} as Category)
    })

    await waitFor(() => {
      expect(expandedDirectoryIds.result.current).toEqual([])
    })
  })
})
