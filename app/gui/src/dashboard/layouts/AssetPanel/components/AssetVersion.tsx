/** @file Displays information describing a specific version of an asset. */
import CompareIcon from '#/assets/compare.svg'
import DuplicateIcon from '#/assets/duplicate.svg'
import RestoreIcon from '#/assets/restore.svg'
import {
  Button,
  ButtonGroup,
  Dialog,
  DialogTrigger,
  Tooltip,
  TooltipTrigger,
} from '#/components/AriaComponents'
import AssetListEventType from '#/events/AssetListEventType'
import { AssetDiffView } from '#/layouts/AssetDiffView'
import { useDispatchAssetListEvent } from '#/layouts/AssetsTable/EventListProvider'
import { useText } from '#/providers/TextProvider'
import type Backend from '#/services/Backend'
import { AssetType, type AnyAsset, type S3ObjectVersion } from '#/services/Backend'
import { formatDateTime } from '#/utilities/dateTime'
import { twMerge } from '#/utilities/tailwindMerge'

/** Props for a {@link AssetVersion}. */
export interface AssetVersionProps {
  readonly placeholder?: boolean
  readonly item: AnyAsset
  readonly number: number
  readonly version: S3ObjectVersion
  readonly latestVersion: S3ObjectVersion
  readonly backend: Backend
  readonly doRestore: () => Promise<void> | void
}

/** Displays information describing a specific version of an asset. */
export function AssetVersion(props: AssetVersionProps) {
  const { placeholder = false, number, version, item, backend, latestVersion, doRestore } = props
  const { getText } = useText()
  const dispatchAssetListEvent = useDispatchAssetListEvent()
  const isProject = item.type === AssetType.project

  const doDuplicate = () => {
    if (isProject) {
      dispatchAssetListEvent({
        type: AssetListEventType.duplicateProject,
        parentKey: item.parentId,
        parentId: item.parentId,
        original: item,
        versionId: version.versionId,
      })
    }
  }

  return (
    <div
      className={twMerge(
        'flex w-full shrink-0 basis-0 select-none flex-row gap-4 rounded-2xl p-2',
        placeholder && 'opacity-50',
      )}
    >
      <div className="flex flex-1 flex-col">
        <div>
          {getText('versionX', number)} {version.isLatest && getText('latestIndicator')}
        </div>

        <time className="text-xs text-not-selected">
          {getText('onDateX', formatDateTime(new Date(version.lastModified)))}
        </time>
      </div>

      <div className="flex items-center gap-1">
        {isProject && (
          <DialogTrigger>
            <TooltipTrigger>
              <Button
                size="medium"
                variant="icon"
                aria-label={getText('compareWithLatest')}
                icon={CompareIcon}
                isDisabled={version.isLatest || placeholder}
              />
              <Tooltip>{getText('compareWithLatest')}</Tooltip>
            </TooltipTrigger>
            <Dialog type="fullscreen" title={getText('compareVersionXWithLatest', number)}>
              {(opts) => (
                <div className="flex h-full flex-col gap-3">
                  <ButtonGroup>
                    <TooltipTrigger>
                      <Button
                        size="medium"
                        variant="icon"
                        aria-label={getText('restoreThisVersion')}
                        icon={RestoreIcon}
                        isDisabled={version.isLatest || placeholder}
                        onPress={async () => {
                          await doRestore()
                          opts.close()
                        }}
                      />
                      <Tooltip>{getText('restoreThisVersion')}</Tooltip>
                    </TooltipTrigger>
                    <TooltipTrigger>
                      <Button
                        size="medium"
                        variant="icon"
                        aria-label={getText('duplicateThisVersion')}
                        icon={DuplicateIcon}
                        isDisabled={placeholder}
                        onPress={() => {
                          doDuplicate()
                          opts.close()
                        }}
                      />
                      <Tooltip>{getText('duplicateThisVersion')}</Tooltip>
                    </TooltipTrigger>
                  </ButtonGroup>
                  <AssetDiffView
                    latestVersionId={latestVersion.versionId}
                    versionId={version.versionId}
                    project={item}
                    backend={backend}
                  />
                </div>
              )}
            </Dialog>
          </DialogTrigger>
        )}
        {isProject && (
          <TooltipTrigger>
            <Button
              size="medium"
              variant="icon"
              aria-label={getText('restoreThisVersion')}
              icon={RestoreIcon}
              isDisabled={version.isLatest || placeholder}
              onPress={doRestore}
            />
            <Tooltip>{getText('restoreThisVersion')}</Tooltip>
          </TooltipTrigger>
        )}
        {isProject && (
          <TooltipTrigger>
            <Button
              size="medium"
              variant="icon"
              aria-label={getText('duplicateThisVersion')}
              icon={DuplicateIcon}
              isDisabled={placeholder}
              onPress={doDuplicate}
            />
            <Tooltip>{getText('duplicateThisVersion')}</Tooltip>
          </TooltipTrigger>
        )}
      </div>
    </div>
  )
}
