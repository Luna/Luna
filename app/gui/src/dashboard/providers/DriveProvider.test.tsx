/**
 * @file Tests for {@link DriveProvider}
 */
import type { Category } from '#/layouts/CategorySwitcher/Category'
import { act, renderHook, type RenderHookOptions, type RenderHookResult } from '#/test'
import { describe, expect, it } from 'vitest'
import { DirectoryId } from '../services/Backend'
import DriveProvider, {
  useExpandedDirectoryIds,
  useSetCategory,
  useSetExpandedDirectoryIds,
} from './DriveProvider'

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
  it('should render', () => {
    const { result: setCategory } = renderDriveProviderHook(() => useSetCategory())
    const { result: setExpandedDirectoryIds } = renderDriveProviderHook(() =>
      useSetExpandedDirectoryIds(),
    )

    act(() => {
      setExpandedDirectoryIds.current([DirectoryId('test-123')])
    })

    const { result: expandedDirectoryIds } = renderDriveProviderHook(() =>
      useExpandedDirectoryIds(),
    )

    expect(expandedDirectoryIds.current).toEqual([DirectoryId('test-123')])

    act(() => {
      // eslint-disable-next-line no-restricted-syntax
      setCategory.current({} as Category)
    })

    expect(expandedDirectoryIds.current).toEqual([])
  })
})
