/** @file A selector for all possible permissions. */
import { useRef, useState, type JSX } from 'react'

import type { AssetType } from '@common/services/Backend'

import { Button } from '#/components/AriaComponents'
import PermissionTypeSelector from '#/components/dashboard/PermissionTypeSelector'
import Modal from '#/components/Modal'
import { useText } from '#/providers/TextProvider'
import {
  DOCS_CLASS_NAME,
  EXEC_CLASS_NAME,
  FROM_PERMISSION_ACTION,
  PERMISSION_CLASS_NAME,
  Permission,
  TYPE_TO_PERMISSION_ACTION,
  TYPE_TO_TEXT_ID,
  toPermissionAction,
  type PermissionAction,
} from '#/utilities/permissions'
import { twJoin } from '#/utilities/tailwindMerge'

/** The horizontal offset of the {@link PermissionTypeSelector} from its parent element. */
const TYPE_SELECTOR_X_OFFSET_PX = -8
/** The vertical offset of the {@link PermissionTypeSelector} from its parent element. */
const TYPE_SELECTOR_Y_OFFSET_PX = 28
/**
 * The vertical offset of the label's clip path from its parent element.
 * Optimized for 100% zoom.
 */
const LABEL_CLIP_Y_OFFSET_PX = 0.5
/** The border radius of the permission label. */
const LABEL_BORDER_RADIUS_PX = 12
/** The width of the straight section of the permission label. */
const LABEL_STRAIGHT_WIDTH_PX = 97

/** Props for a {@link PermissionSelector}. */
export interface PermissionSelectorProps {
  readonly showDelete?: boolean
  /** When `true`, the button is not clickable. */
  readonly isDisabled?: boolean
  /** When `true`, the button has lowered opacity when it is disabled. */
  readonly isInput?: boolean
  /** Overrides the vertical offset of the {@link PermissionTypeSelector}. */
  readonly typeSelectorYOffsetPx?: number
  readonly error?: string | null
  readonly selfPermission: PermissionAction
  /** If this prop changes, the internal state will be updated too. */
  readonly action: PermissionAction
  readonly assetType: AssetType
  readonly className?: string
  readonly onChange: (action: PermissionAction) => void
  readonly doDelete?: () => void
}

/** A horizontal selector for all possible permissions. */
export default function PermissionSelector(props: PermissionSelectorProps) {
  const { showDelete = false, isDisabled = false, isInput = false, typeSelectorYOffsetPx } = props
  const { error, selfPermission, action: actionRaw, assetType, className } = props
  const { onChange, doDelete } = props
  const { getText } = useText()
  const [action, setActionRaw] = useState(actionRaw)
  const [TheChild, setTheChild] = useState<(() => JSX.Element) | null>()
  const permissionSelectorButtonRef = useRef<HTMLButtonElement>(null)
  const permission = FROM_PERMISSION_ACTION[action]

  const setAction = (newAction: PermissionAction) => {
    setActionRaw(newAction)
    onChange(newAction)
  }

  const doShowPermissionTypeSelector = () => {
    if (permissionSelectorButtonRef.current != null) {
      const position = permissionSelectorButtonRef.current.getBoundingClientRect()
      const originalLeft = position.left + window.scrollX
      const originalTop = position.top + window.scrollY
      const left = originalLeft + TYPE_SELECTOR_X_OFFSET_PX
      const top = originalTop + (typeSelectorYOffsetPx ?? TYPE_SELECTOR_Y_OFFSET_PX)
      // The border radius of the label. This is half of the label's height.
      const r = LABEL_BORDER_RADIUS_PX
      const clipPath =
        // A rectangle covering the entire screen
        'path(evenodd, "M0 0L3840 0 3840 2160 0 2160Z' +
        // Move to top left of label
        `M${originalLeft + r} ${originalTop + LABEL_CLIP_Y_OFFSET_PX}` +
        // Top straight edge of label
        `h${LABEL_STRAIGHT_WIDTH_PX}` +
        // Right semicircle of label
        `a${r} ${r} 0 0 1 0 ${r * 2}` +
        // Bottom straight edge of label
        `h-${LABEL_STRAIGHT_WIDTH_PX}` +
        // Left semicircle of label
        `a${r} ${r} 0 0 1 0 -${r * 2}Z")`
      setTheChild((oldTheChild) =>
        oldTheChild != null ? null : (
          function Child() {
            return (
              <Modal
                className="fixed size-full overflow-auto"
                onClick={() => {
                  setTheChild(null)
                }}
              >
                <div style={{ clipPath }} className="absolute size-full bg-dim" />
                <PermissionTypeSelector
                  showDelete={showDelete}
                  type={permission.type}
                  assetType={assetType}
                  selfPermission={selfPermission}
                  style={{ left, top }}
                  onChange={(type) => {
                    setTheChild(null)
                    if (type === Permission.delete) {
                      doDelete?.()
                    } else {
                      const newAction = TYPE_TO_PERMISSION_ACTION[type]
                      const newPermissions = FROM_PERMISSION_ACTION[newAction]
                      if ('docs' in permission && 'docs' in newPermissions) {
                        setAction(toPermissionAction({ ...permission, type }))
                      } else {
                        setAction(TYPE_TO_PERMISSION_ACTION[type])
                      }
                    }
                  }}
                />
              </Modal>
            )
          }
        ),
      )
    }
  }

  let permissionDisplay: JSX.Element

  switch (permission.type) {
    case Permission.read:
    case Permission.view: {
      permissionDisplay = (
        <div className="flex w-[121px] gap-px">
          <Button
            size="xsmall"
            variant="custom"
            rounded="none"
            ref={permissionSelectorButtonRef}
            isDisabled={isDisabled}
            isActive={!isDisabled || !isInput}
            {...(isDisabled && error != null ? { title: error } : {})}
            className={twJoin('flex-1 rounded-l-full', PERMISSION_CLASS_NAME[permission.type])}
            onPress={doShowPermissionTypeSelector}
          >
            {getText(TYPE_TO_TEXT_ID[permission.type])}
          </Button>
          <Button
            size="xsmall"
            variant="custom"
            rounded="none"
            isDisabled={isDisabled}
            isActive={permission.docs && (!isDisabled || !isInput)}
            {...(isDisabled && error != null ? { title: error } : {})}
            className={twJoin('flex-1', DOCS_CLASS_NAME)}
            onPress={() => {
              setAction(
                toPermissionAction({
                  type: permission.type,
                  execute: false,
                  docs: !permission.docs,
                }),
              )
            }}
          >
            {getText('docsPermissionModifier')}
          </Button>
          <Button
            size="xsmall"
            variant="custom"
            rounded="none"
            isDisabled={isDisabled}
            isActive={permission.execute && (!isDisabled || !isInput)}
            {...(isDisabled && error != null ? { title: error } : {})}
            className={twJoin('flex-1 rounded-r-full', EXEC_CLASS_NAME)}
            onPress={() => {
              setAction(
                toPermissionAction({
                  type: permission.type,
                  execute: !permission.execute,
                  docs: false,
                }),
              )
            }}
          >
            {getText('execPermissionModifier')}
          </Button>
        </div>
      )
      break
    }
    default: {
      permissionDisplay = (
        <Button
          size="xsmall"
          variant="custom"
          ref={permissionSelectorButtonRef}
          isDisabled={isDisabled}
          rounded="full"
          isActive={!isDisabled || !isInput}
          {...(isDisabled && error != null ? { title: error } : {})}
          className={twJoin('w-[121px]', PERMISSION_CLASS_NAME[permission.type])}
          onPress={doShowPermissionTypeSelector}
        >
          {getText(TYPE_TO_TEXT_ID[permission.type])}
        </Button>
      )
      break
    }
  }

  return (
    <div className={className}>
      {permissionDisplay}
      {TheChild && <TheChild />}
    </div>
  )
}
