/** @file A panel containing the description and settings for an asset. */
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react'

import { Button, ButtonGroup } from '#/components/AriaComponents'
import AssetProperties from '#/layouts/AssetPanel/AssetProperties'
import ProjectExecutions from '#/layouts/AssetPanel/ProjectExecutions'
import ProjectSessions from '#/layouts/AssetPanel/ProjectSessions'
import * as z from 'zod'

import AssetVersions from '#/layouts/AssetVersions/AssetVersions'
import type Category from '#/layouts/CategorySwitcher/Category'
import { useLocalStorage } from '#/providers/LocalStorageProvider'
import { useText } from '#/providers/TextProvider'
import type Backend from '#/services/Backend'
import { AssetType, BackendType } from '#/services/Backend'
import type { AnyAssetTreeNode } from '#/utilities/AssetTreeNode'

import LocalStorage from '#/utilities/LocalStorage'
import { twMerge } from '#/utilities/tailwindMerge'

// =====================
// === AssetPanelTab ===
// =====================

/** Determines the content of the {@link AssetPanel}. */
enum AssetPanelTab {
  properties = 'properties',
  versions = 'versions',
  projectSessions = 'projectSessions',
  executions = 'executions',
}

// ============================
// === Global configuration ===
// ============================

declare module '#/utilities/LocalStorage' {
  /** */
  interface LocalStorageData {
    readonly assetPanelTab: AssetPanelTab
  }
}

LocalStorage.registerKey('assetPanelTab', {
  schema: z.nativeEnum(AssetPanelTab),
})

// ==================
// === AssetPanel ===
// ==================

/** The subset of {@link AssetPanelProps} that are required to be supplied by the row. */
export interface AssetPanelRequiredProps {
  readonly backend: Backend | null
  readonly item: AnyAssetTreeNode | null
  readonly setItem: Dispatch<SetStateAction<AnyAssetTreeNode>> | null
}

/** Props for an {@link AssetPanel}. */
export interface AssetPanelProps extends AssetPanelRequiredProps {
  readonly isVisible: boolean
  readonly isReadonly?: boolean
  readonly category: Category
}

/** A panel containing the description and settings for an asset. */
export default function AssetPanel(props: AssetPanelProps) {
  const { isVisible, backend, isReadonly = false, item, setItem, category } = props
  const isCloud = backend?.type === BackendType.remote

  const { getText } = useText()
  const { localStorage } = useLocalStorage()
  const [initialized, setInitialized] = useState(false)
  const initializedRef = useRef(initialized)
  initializedRef.current = initialized
  const [tabRaw, setTab] = useState(
    () => localStorage.get('assetPanelTab') ?? AssetPanelTab.properties,
  )
  const tab = (() => {
    if (!isCloud) {
      return AssetPanelTab.properties
    } else if (
      (item?.item.type === AssetType.secret || item?.item.type === AssetType.directory) &&
      tabRaw === AssetPanelTab.versions
    ) {
      return AssetPanelTab.properties
    } else if (item?.item.type !== AssetType.project && tabRaw === AssetPanelTab.projectSessions) {
      return AssetPanelTab.properties
    } else {
      return tabRaw
    }
  })()

  useEffect(() => {
    // This prevents secrets and directories always setting the tab to `properties`
    // (because they do not support the `versions` tab).
    if (initializedRef.current) {
      localStorage.set('assetPanelTab', tabRaw)
    }
  }, [tabRaw, localStorage])

  useEffect(() => {
    setInitialized(true)
  }, [])

  return (
    <div
      data-testid="asset-panel"
      className={twMerge(
        'pointer-events-none absolute flex h-full w-asset-panel flex-col gap-[22px] bg-white p-4 pl-asset-panel-l transition-[box-shadow] clip-path-left-shadow',
        isVisible ? 'shadow-softer' : '',
      )}
      onClick={(event) => {
        event.stopPropagation()
      }}
    >
      <ButtonGroup className="mt-0.5 grow-0 basis-8">
        {isCloud &&
          item != null &&
          item.item.type !== AssetType.secret &&
          item.item.type !== AssetType.directory && (
            <Button
              size="medium"
              variant="bar"
              className={twMerge(
                'pointer-events-auto disabled:opacity-100',
                tab === AssetPanelTab.versions && 'bg-primary/[8%] opacity-100',
              )}
              onPress={() => {
                setTab((oldTab) =>
                  oldTab === AssetPanelTab.versions ?
                    AssetPanelTab.properties
                  : AssetPanelTab.versions,
                )
              }}
            >
              {getText('versions')}
            </Button>
          )}
        {isCloud && item != null && item.item.type === AssetType.project && (
          <Button
            size="medium"
            variant="bar"
            className={twMerge(
              'pointer-events-auto disabled:opacity-100',
              tab === AssetPanelTab.projectSessions && 'bg-primary/[8%] opacity-100',
            )}
            onPress={() => {
              setTab((oldTab) =>
                oldTab === AssetPanelTab.projectSessions ?
                  AssetPanelTab.properties
                : AssetPanelTab.projectSessions,
              )
            }}
          >
            {getText('projectSessions')}
          </Button>
        )}
        {isCloud && item != null && item.item.type === AssetType.project && (
          <Button
            size="medium"
            variant="bar"
            className={twMerge(
              'pointer-events-auto disabled:opacity-100',
              tab === AssetPanelTab.executions && 'bg-primary/[8%] opacity-100',
            )}
            onPress={() => {
              setTab((oldTab) =>
                oldTab === AssetPanelTab.executions ?
                  AssetPanelTab.properties
                : AssetPanelTab.executions,
              )
            }}
          >
            {getText('executions')}
          </Button>
        )}
        {/* Spacing. The top right asset and user bars overlap this area. */}
        <div className="grow" />
      </ButtonGroup>
      {item == null || setItem == null || backend == null ?
        <div className="grid grow place-items-center text-lg">
          {getText('selectExactlyOneAssetToViewItsDetails')}
        </div>
      : <>
          {tab === AssetPanelTab.properties && (
            <AssetProperties
              backend={backend}
              isReadonly={isReadonly}
              item={item}
              setItem={setItem}
              category={category}
            />
          )}
          {tab === AssetPanelTab.versions && <AssetVersions backend={backend} item={item} />}
          {tab === AssetPanelTab.projectSessions && item.type === AssetType.project && (
            <ProjectSessions backend={backend} item={item} />
          )}
          {tab === AssetPanelTab.executions && item.type === AssetType.project && (
            <ProjectExecutions backend={backend} item={item.item} />
          )}
        </>
      }
    </div>
  )
}
