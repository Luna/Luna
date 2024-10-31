/** @file An area that contains focusable children. */
import * as React from 'react'

import * as detect from 'enso-common/src/detect'

import AreaFocusProvider from '#/providers/AreaFocusProvider'
import FocusClassesProvider, * as focusClassProvider from '#/providers/FocusClassProvider'
import type * as focusDirectionProvider from '#/providers/FocusDirectionProvider'
import FocusDirectionProvider from '#/providers/FocusDirectionProvider'
import * as navigator2DProvider from '#/providers/Navigator2DProvider'

import * as aria from '#/components/aria'
import * as withFocusScope from '#/components/styled/withFocusScope'
import { useSingleUnmount } from '#/hooks/lifecycleHooks'
import { useSyncRef } from '#/hooks/syncRefHooks'

// =================
// === FocusArea ===
// =================

/** Props returned by {@link aria.useFocusWithin}. */
export interface FocusWithinProps {
  readonly ref: React.RefCallback<HTMLElement | SVGElement | null>
  readonly onFocus: NonNullable<aria.DOMAttributes<Element>['onFocus']>
  readonly onBlur: NonNullable<aria.DOMAttributes<Element>['onBlur']>
}

/** Props for a {@link FocusArea} */
export interface FocusAreaProps {
  /** Should ONLY be passed in exceptional cases. */
  readonly focusChildClass?: string
  /** Should ONLY be passed in exceptional cases. */
  readonly focusDefaultClass?: string
  readonly active?: boolean
  readonly direction: focusDirectionProvider.FocusDirection
  readonly children: (props: FocusWithinProps) => React.JSX.Element
}

/** An area that can be focused within. */
function FocusArea(props: FocusAreaProps) {
  const { active = true, direction, children } = props
  const { focusChildClass = 'focus-child', focusDefaultClass = 'focus-default' } = props
  const { focusChildClass: outerFocusChildClass } = focusClassProvider.useFocusClasses()
  const [areaFocus, setAreaFocus] = React.useState(false)
  const { focusWithinProps } = aria.useFocusWithin({ onFocusWithinChange: setAreaFocus })
  const focusManager = aria.useFocusManager()
  const navigator2D = navigator2DProvider.useNavigator2D()
  const rootRef = React.useRef<HTMLElement | SVGElement | null>(null)
  const cleanupRef = React.useRef(() => {})
  const focusChildClassRef = useSyncRef(focusChildClass)
  const focusDefaultClassRef = useSyncRef(focusDefaultClass)

  useSingleUnmount(() => {
    cleanupRef.current()
  })

  const cachedChildren = React.useMemo(
    () =>
      // This is REQUIRED, otherwise `useFocusWithin` does not work with components from
      // `react-aria-components`.
      // eslint-disable-next-line no-restricted-syntax, react-compiler/react-compiler
      children({
        ref: (element) => {
          rootRef.current = element
          cleanupRef.current()
          if (active && element != null && focusManager != null) {
            const focusFirst = focusManager.focusFirst.bind(null, {
              accept: (other) => other.classList.contains(focusChildClassRef.current),
            })
            const focusLast = focusManager.focusLast.bind(null, {
              accept: (other) => other.classList.contains(focusChildClassRef.current),
            })
            const focusCurrent = () =>
              focusManager.focusFirst({
                accept: (other) => other.classList.contains(focusDefaultClassRef.current),
              }) ?? focusFirst()
            cleanupRef.current = navigator2D.register(element, {
              focusPrimaryChild: focusCurrent,
              focusWhenPressed:
                direction === 'horizontal' ?
                  { right: focusFirst, left: focusLast }
                : { down: focusFirst, up: focusLast },
            })
          } else {
            cleanupRef.current = () => {}
          }
          if (element != null && detect.IS_DEV_MODE) {
            if (active) {
              element.dataset.focusArea = ''
            } else {
              delete element.dataset.focusArea
            }
          }
        },
        ...focusWithinProps,
      } as FocusWithinProps),
    [
      children,
      focusWithinProps,
      active,
      focusManager,
      navigator2D,
      direction,
      focusChildClassRef,
      focusDefaultClassRef,
    ],
  )

  const result = (
    <FocusDirectionProvider direction={direction}>
      <AreaFocusProvider areaFocus={areaFocus}>{cachedChildren}</AreaFocusProvider>
    </FocusDirectionProvider>
  )
  return focusChildClass === outerFocusChildClass ? result : (
      <FocusClassesProvider focusChildClass={focusChildClass}>{result}</FocusClassesProvider>
    )
}

/** An area that can be focused within. */
export default withFocusScope.withFocusScope(FocusArea)
