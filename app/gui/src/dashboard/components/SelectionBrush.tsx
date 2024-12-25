/** @file A selection brush to indicate the area being selected by the mouse drag action. */
import * as React from 'react'

import Portal from '#/components/Portal'
import * as animationHooks from '#/hooks/animationHooks'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { useEventListener } from '#/hooks/eventListenerHooks'
import * as modalProvider from '#/providers/ModalProvider'
import * as eventModule from '#/utilities/event'
import type * as geometry from '#/utilities/geometry'
import * as tailwindMerge from '#/utilities/tailwindMerge'
import { motion, useMotionValue } from 'framer-motion'
import { useRAFThrottle } from '../hooks/useRaf'

// =================
// === Constants ===
// =================

/**
 * Controls the speed of animation of the {@link SelectionBrush} when the
 * mouse is released and the selection brush collapses back to zero size.
 */
const ANIMATION_TIME_HORIZON = 60
/**
 * Defines the minimal distance that the mouse must move before
 * we consider that user has started a selection.
 */
const DEAD_ZONE_SIZE = 12

// eslint-disable-next-line no-restricted-syntax
const noop = () => {}

// ======================
// === SelectionBrush ===
// ======================

/** Props for a {@link SelectionBrush}. */
export interface SelectionBrushProps {
  readonly targetRef: React.RefObject<HTMLElement>
  readonly margin?: number
  readonly onDrag: (rectangle: geometry.DetailedRectangle, event: MouseEvent) => void
  readonly onDragEnd: (event: MouseEvent) => void
  readonly onDragCancel: () => void
}

/** A selection brush to indicate the area being selected by the mouse drag action. */
export default function SelectionBrush(props: SelectionBrushProps) {
  const { targetRef, margin = 0 } = props
  const { modalRef } = modalProvider.useModalRef()

  const initialMousePositionRef = React.useRef<geometry.Coordinate2D | null>(null)
  /**
   * Whether the mouse is currently down.
   */
  const isMouseDownRef = React.useRef(false)
  /**
   * Whether the user is currently dragging the selection brush.
   * Unlike the isMouseDown, has a dead zone
   */
  const isDraggingRef = React.useRef(false)

  const didMoveWhileDraggingRef = React.useRef(false)
  const onDrag = useEventCallback(props.onDrag)
  const onDragEnd = useEventCallback(props.onDragEnd)
  const onDragCancel = useEventCallback(props.onDragCancel)
  const lastMouseEvent = React.useRef<MouseEvent | null>(null)
  const parentBounds = React.useRef<DOMRect | null>(null)
  const anchorRef = React.useRef<geometry.Coordinate2D | null>(null)
  const [anchor, setAnchor] = React.useState<geometry.Coordinate2D | null>(null)
  const [position, setPosition] = React.useState<geometry.Coordinate2D | null>(null)
  const [lastSetAnchor, setLastSetAnchor] = React.useState<geometry.Coordinate2D | null>(null)

  const anchorAnimFactor = animationHooks.useApproach(
    anchor != null ? 1 : 0,
    ANIMATION_TIME_HORIZON,
  )
  const hidden =
    anchor == null ||
    position == null ||
    (anchor.left === position.left && anchor.top === position.top)

  React.useEffect(() => {
    if (anchor != null) {
      anchorAnimFactor.skip()
    }
  }, [anchorAnimFactor, anchor])

  React.useEffect(() => {
    const isEventInBounds = (event: MouseEvent, parent?: HTMLElement | null) => {
      if (parent == null) {
        return true
      } else {
        parentBounds.current = parent.getBoundingClientRect()
        return eventModule.isElementInBounds(event, parentBounds.current, margin)
      }
    }
    const unsetAnchor = () => {
      if (anchorRef.current != null) {
        anchorRef.current = null
        setAnchor(null)
      }
    }
    const onMouseDown = (event: MouseEvent) => {
      initialMousePositionRef.current = { left: event.pageX, top: event.pageY }

      if (
        modalRef.current == null &&
        !eventModule.isElementTextInput(event.target) &&
        !(event.target instanceof HTMLButtonElement) &&
        !(event.target instanceof HTMLAnchorElement) &&
        isEventInBounds(event, targetRef.current)
      ) {
        isMouseDownRef.current = true
        didMoveWhileDraggingRef.current = false
        lastMouseEvent.current = event
        const newAnchor = { left: event.pageX, top: event.pageY }
        anchorRef.current = newAnchor
        setAnchor(newAnchor)
        setLastSetAnchor(newAnchor)
        setPosition(newAnchor)
      }
    }
    const onMouseUp = (event: MouseEvent) => {
      if (didMoveWhileDraggingRef.current) {
        onDragEnd(event)
      }
      // The `setTimeout` is required, otherwise the values are changed before the `onClick` handler
      // is executed.
      window.setTimeout(() => {
        isMouseDownRef.current = false
        didMoveWhileDraggingRef.current = false
        initialMousePositionRef.current = null
      })
      unsetAnchor()
    }
    const onMouseMove = (event: MouseEvent) => {
      if (!(event.buttons & 1)) {
        isMouseDownRef.current = false
        initialMousePositionRef.current = null
      }
      if (isMouseDownRef.current) {
        // Left click is being held.
        didMoveWhileDraggingRef.current = true
        lastMouseEvent.current = event
        const positionLeft =
          parentBounds.current == null ?
            event.pageX
          : Math.max(
              parentBounds.current.left - margin,
              Math.min(parentBounds.current.right + margin, event.pageX),
            )
        const positionTop =
          parentBounds.current == null ?
            event.pageY
          : Math.max(
              parentBounds.current.top - margin,
              Math.min(parentBounds.current.bottom + margin, event.pageY),
            )
        setPosition({ left: positionLeft, top: positionTop })
      }
    }
    const onClick = (event: MouseEvent) => {
      if (isMouseDownRef.current && didMoveWhileDraggingRef.current) {
        event.stopImmediatePropagation()
      }
    }
    const onDragStart = () => {
      if (isMouseDownRef.current) {
        isMouseDownRef.current = false
        initialMousePositionRef.current = null
        onDragCancel()
        unsetAnchor()
      }
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('dragstart', onDragStart, { capture: true })
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('click', onClick, { capture: true })
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('dragstart', onDragStart, { capture: true })
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('click', onClick, { capture: true })
    }
  }, [margin, targetRef, modalRef, onDragEnd, onDragCancel])

  const rectangle = React.useMemo(() => {
    if (position != null && lastSetAnchor != null) {
      const start: geometry.Coordinate2D = {
        left:
          position.left * (1 - anchorAnimFactor.value) +
          lastSetAnchor.left * anchorAnimFactor.value,
        top:
          position.top * (1 - anchorAnimFactor.value) + lastSetAnchor.top * anchorAnimFactor.value,
      }

      return {
        left: Math.min(position.left, start.left),
        top: Math.min(position.top, start.top),
        right: Math.max(position.left, start.left),
        bottom: Math.max(position.top, start.top),
        width: Math.abs(position.left - start.left),
        height: Math.abs(position.top - start.top),
        signedWidth: position.left - start.left,
        signedHeight: position.top - start.top,
      }
    } else {
      return null
    }
  }, [anchorAnimFactor.value, lastSetAnchor, position])

  const selectionRectangle = React.useMemo(() => (hidden ? null : rectangle), [hidden, rectangle])

  React.useEffect(() => {
    if (selectionRectangle != null && lastMouseEvent.current != null) {
      onDrag(selectionRectangle, lastMouseEvent.current)
    }
  }, [onDrag, selectionRectangle])

  const brushStyle =
    rectangle == null ?
      {}
    : {
        left: `${rectangle.left}px`,
        top: `${rectangle.top}px`,
        width: `${rectangle.width}px`,
        height: `${rectangle.height}px`,
      }
  return (
    <Portal>
      <div
        className={tailwindMerge.twMerge(
          'pointer-events-none fixed z-1 box-content rounded-selection-brush border-transparent bg-selection-brush transition-border-margin',
          hidden ? 'm border-0' : '-m-selection-brush-border border-selection-brush',
        )}
        style={brushStyle}
      />
    </Portal>
  )
}

/**
 * Parameters for the onDrag callback.
 */
export interface OnDragParams {
  readonly diff: geometry.Coordinate2D
  readonly start: geometry.Coordinate2D
  readonly current: geometry.Coordinate2D
  readonly rectangle: geometry.DetailedRectangle
  readonly event: PointerEvent
}

/**
 * Props for a {@link SelectionBrushV2}.
 */
export interface SelectionBrushV2Props {
  readonly onDragStart?: (event: PointerEvent) => void
  readonly onDrag?: (params: OnDragParams) => void
  readonly onDragEnd?: (event: PointerEvent) => void
  readonly onDragCancel?: () => void

  readonly targetRef: React.RefObject<HTMLElement>
  readonly isDisabled?: boolean
  readonly preventDrag?: (event: PointerEvent) => boolean
}

/**
 * A selection brush to indicate the area being selected by the mouse drag action.
 */
export function SelectionBrushV2(props: SelectionBrushV2Props) {
  const {
    targetRef,
    preventDrag = () => false,
    onDragStart = noop,
    onDrag = noop,
    onDragEnd = noop,
    onDragCancel = noop,
    isDisabled = false,
  } = props

  const [isDragging, setIsDragging] = React.useState(false)

  const hasPassedDeadZoneRef = React.useRef<boolean>(false)
  const startPositionRef = React.useRef<geometry.Coordinate2D | null>(null)
  const currentPositionRef = React.useRef<geometry.Coordinate2D | null>(null)

  const left = useMotionValue<geometry.DetailedRectangle['left'] | null>(null)
  const top = useMotionValue<geometry.DetailedRectangle['top'] | null>(null)
  const width = useMotionValue<geometry.DetailedRectangle['width'] | null>(null)
  const height = useMotionValue<geometry.DetailedRectangle['height'] | null>(null)

  const preventDragStableCallback = useEventCallback(preventDrag)
  const onDragStartStableCallback = useEventCallback(onDragStart)
  const onDragStableCallback = useEventCallback(onDrag)
  const onDragEndStableCallback = useEventCallback(onDragEnd)
  const onDragCancelStableCallback = useEventCallback(onDragCancel)

  const { scheduleRAF, cancelRAF } = useRAFThrottle()

  const startDragging = useEventCallback(() => {
    setIsDragging(true)
    hasPassedDeadZoneRef.current = true
  })

  const resetState = useEventCallback(() => {
    hasPassedDeadZoneRef.current = false
    startPositionRef.current = null
    currentPositionRef.current = null
    setIsDragging(false)
    cancelRAF()
  })

  useEventListener(
    'pointerdown',
    (event) => {
      resetState()

      const shouldSkip = preventDragStableCallback(event)

      if (shouldSkip) {
        return
      }

      startPositionRef.current = { left: event.pageX, top: event.pageY }
      currentPositionRef.current = { left: event.pageX, top: event.pageY }

      onDragStartStableCallback(event)
    },
    targetRef,
    { isDisabled, capture: true, passive: true },
  )

  useEventListener(
    'pointermove',
    (event) => {
      scheduleRAF(() => {
        if (startPositionRef.current == null) {
          return
        }

        currentPositionRef.current = { left: event.pageX, top: event.pageY }

        const rectangle: geometry.DetailedRectangle = {
          left: Math.min(startPositionRef.current.left, currentPositionRef.current.left),
          top: Math.min(startPositionRef.current.top, currentPositionRef.current.top),
          right: Math.max(startPositionRef.current.left, currentPositionRef.current.left),
          bottom: Math.max(startPositionRef.current.top, currentPositionRef.current.top),
          width: Math.abs(startPositionRef.current.left - currentPositionRef.current.left),
          height: Math.abs(startPositionRef.current.top - currentPositionRef.current.top),
          signedWidth: currentPositionRef.current.left - startPositionRef.current.left,
          signedHeight: currentPositionRef.current.top - startPositionRef.current.top,
        }

        const diff: geometry.Coordinate2D = {
          left: currentPositionRef.current.left - startPositionRef.current.left,
          top: currentPositionRef.current.top - startPositionRef.current.top,
        }

        if (hasPassedDeadZoneRef.current === false) {
          hasPassedDeadZoneRef.current = !isInDeadZone(
            startPositionRef.current,
            currentPositionRef.current,
            DEAD_ZONE_SIZE,
          )
        }

        if (hasPassedDeadZoneRef.current) {
          targetRef.current?.setPointerCapture(event.pointerId)

          startDragging()

          left.set(rectangle.left)
          top.set(rectangle.top)
          width.set(rectangle.width)
          height.set(rectangle.height)

          onDragStableCallback({
            diff,
            start: startPositionRef.current,
            current: currentPositionRef.current,
            rectangle,
            event,
          })
        }
      })
    },
    document,
    { isDisabled, capture: true, passive: true },
  )

  useEventListener(
    'pointerup',
    (event) => {
      resetState()

      targetRef.current?.releasePointerCapture(event.pointerId)

      if (isDragging) {
        onDragEndStableCallback(event)
      }
    },
    document,
    { isDisabled, capture: true, passive: true },
  )

  useEventListener(
    'pointercancel',
    (event) => {
      resetState()

      targetRef.current?.releasePointerCapture(event.pointerId)

      if (isDragging) {
        onDragEndStableCallback(event)
        onDragCancelStableCallback()
      }
    },
    document,
    { isDisabled, capture: true, passive: true },
  )

  return (
    <Portal>
      <motion.div
        data-testid="selection-brush"
        data-is-dragging={isDragging}
        // setting before:: gives the confidence that the pointer won't interact with underlying elements
        className="pointer-events-none absolute z-10 rounded-2xl border-2 border-primary/5 bg-primary/5"
        style={{
          left,
          top,
          width,
          height,
          opacity: isDragging ? 1 : 0,
        }}
      />
    </Portal>
  )
}

/**
 * Whether the current position is in the dead zone.
 * @param initialPosition - The initial position.
 * @param currentPosition - The current position.
 * @param deadZoneSize - The size of the dead zone.
 * @returns Whether the current position is in the dead zone.
 */
function isInDeadZone(
  initialPosition: geometry.Coordinate2D,
  currentPosition: geometry.Coordinate2D,
  deadZoneSize: number,
) {
  const horizontalDistance = Math.abs(initialPosition.left - currentPosition.left)
  const verticalDistance = Math.abs(initialPosition.top - currentPosition.top)

  return horizontalDistance < deadZoneSize && verticalDistance < deadZoneSize
}
