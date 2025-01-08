import { DirectoryId } from '#/services/Backend'
import { act, renderHook, type RenderHookOptions, type RenderHookResult } from '#/test'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { useStore } from 'zustand'
import type { CategoryId } from '../../layouts/CategorySwitcher/Category'
import DriveProvider, { useDriveStore } from '../DriveProvider'

function renderDriveProviderHook<Result, Props>(
  hook: (props: Props) => Result,
  options?: Omit<RenderHookOptions<Props>, 'wrapper'>,
): RenderHookResult<Result, Props> {
  let currentCategoryId: CategoryId = 'cloud'
  let setCategoryId: (categoryId: CategoryId) => void
  let doResetAssetTableState: () => void

  return renderHook(
    (props) => {
      const result = hook(props)
      return { ...result, setCategoryId }
    },
    {
      wrapper: ({ children }) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [category, setCategory] = useState(() => currentCategoryId)
        currentCategoryId = category
        setCategoryId = (nextCategoryId) => {
          setCategory(nextCategoryId)
          doResetAssetTableState()
        }

        return (
          <DriveProvider
            launchedProjects={[]}
            cloudCategories={[]}
            localCategories={[]}
            // UNSAFE, but fine in this case as this value is not accessed as
            // the categories lists above are empty.
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            remoteBackend={null!}
            localBackend={null}
          >
            {({ resetAssetTableState }) => {
              doResetAssetTableState = resetAssetTableState
              return children
            }}
          </DriveProvider>
        )
      },
      ...options,
    },
  )
}

describe('<DriveProvider />', () => {
  it('Should reset expanded directory ids when category changes', () => {
    const driveAPI = renderDriveProviderHook((setCategoryId: (categoryId: CategoryId) => void) => {
      const store = useDriveStore()
      return useStore(
        store,
        ({
          toggleDirectoryExpansion,
          expandedDirectories,
          selectedKeys,
          visuallySelectedKeys,
        }) => ({
          expandedDirectories,
          toggleDirectoryExpansion,
          setCategoryId,
          selectedKeys,
          visuallySelectedKeys,
        }),
      )
    })

    act(() => {
      driveAPI.result.current.toggleDirectoryExpansion(
        [DirectoryId('directory-test-123')],
        true,
        'cloud',
      )
    })

    expect(driveAPI.result.current.expandedDirectories).toEqual([DirectoryId('directory-test-123')])

    act(() => {
      driveAPI.result.current.setCategoryId('recent')
    })

    expect(driveAPI.result.current.expandedDirectories).toEqual([])
    expect(driveAPI.result.current.selectedKeys).toEqual(new Set())
    expect(driveAPI.result.current.visuallySelectedKeys).toEqual(null)

    act(() => {
      // Set the category back to the default category (`cloud`).
      driveAPI.result.current.setCategoryId('cloud')
    })
    // The original expanded directories should be back.
  })
})
