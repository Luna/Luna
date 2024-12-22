import { act, renderHook, type RenderHookOptions, type RenderHookResult } from '#/test'
import { describe, expect, it } from 'vitest'
import { useStore } from 'zustand'
import { DirectoryId } from '../../services/Backend'
import DriveProvider, { useDriveStore } from '../DriveProvider'

function renderDriveProviderHook<Result, Props>(
  hook: (props: Props) => Result,
  options?: Omit<RenderHookOptions<Props>, 'wrapper'>,
): RenderHookResult<Result, Props> {
  return renderHook(hook, { wrapper: DriveProvider, ...options })
}

describe('<DriveProvider />', () => {
  it('Should reset expanded directory ids when category changes', () => {
    const driveAPI = renderDriveProviderHook(() => {
      const store = useDriveStore()
      return useStore(
        store,
        ({ setCategoryId, setExpandedDirectoryIds, expandedDirectoryIds }) => ({
          expandedDirectoryIds,
          setCategoryId,
          setExpandedDirectoryIds,
        }),
      )
    })

    act(() => {
      driveAPI.result.current.setExpandedDirectoryIds([DirectoryId('directory-test-123')])
    })

    expect(driveAPI.result.current.expandedDirectoryIds).toEqual([
      DirectoryId('directory-test-123'),
    ])

    act(() => {
      driveAPI.result.current.setCategoryId('recent')
    })

    expect(driveAPI.result.current.expandedDirectoryIds).toEqual([])
  })
})
