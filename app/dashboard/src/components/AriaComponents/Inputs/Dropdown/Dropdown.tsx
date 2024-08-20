/** @file A styled dropdown. */
import { useEffect, useMemo, useRef, useState, type ForwardedRef, type ReactNode } from 'react'

import CheckMarkIcon from '#/assets/check_mark.svg'
import FolderArrowIcon from '#/assets/folder_arrow.svg'
import { ListBox, ListBoxItem, mergeProps, useFocusWithin } from '#/components/aria'
import FocusRing from '#/components/styled/FocusRing'
import SvgMask from '#/components/SvgMask'
import { useSyncRef } from '#/hooks/syncRefHooks'
import { mergeRefs } from '#/utilities/mergeRefs'
import { forwardRef } from '#/utilities/react'
import { tv } from '#/utilities/tailwindVariants'

const DROPDOWN_STYLES = tv({
  base: 'focus-child group relative flex w-max cursor-pointer flex-col items-start whitespace-nowrap rounded-input leading-cozy',
  variants: {
    isFocused: {
      true: {
        container: 'z-1',
        options: 'before:h-full before:shadow-soft',
        optionsContainer: 'grid-rows-1fr',
        input: 'z-1',
      },
      false: {
        container: 'overflow-hidden',
        options: 'before:h-6 group-hover:before:bg-hover-bg',
        optionsContainer: 'grid-rows-0fr',
      },
    },
    isReadOnly: {
      true: {
        input: 'read-only',
      },
    },
    multiple: {
      true: {
        optionsItem: 'hover:font-semibold',
      },
    },
  },
  slots: {
    container: 'absolute left-0 h-full w-full min-w-max',
    options:
      'relative before:absolute before:top before:w-full before:rounded-input before:border-0.5 before:border-primary/20 before:backdrop-blur-default before:transition-colors',
    optionsSpacing: 'padding relative h-6',
    optionsContainer:
      'relative grid max-h-dropdown-items w-full overflow-auto rounded-input transition-grid-template-rows',
    optionsList: 'overflow-hidden',
    optionsItem:
      'flex h-6 items-center gap-dropdown-arrow rounded-input px-input-x transition-colors selected:focus:cursor-default selected:focus:bg-frame selected:focus:font-bold selected:focus:focus-ring not-focus:hover:bg-hover-bg not-selected:hover:bg-hover-bg',
    input: 'relative flex h-6 items-center gap-dropdown-arrow px-input-x',
    inputDisplay: 'grow',
    hiddenOptions: 'flex h-0 flex-col overflow-hidden',
    hiddenOption: 'flex gap-dropdown-arrow px-input-x font-bold',
  },
})

// ================
// === Dropdown ===
// ================

/** Props for a list item child. */
interface InternalChildProps<T> {
  readonly item: T
}

/** Props for the display of the currently selected item, when the dropdown supports multiple children. */
interface InternalChildrenProps<T> {
  readonly items: readonly T[]
  /** This is the value passed as {@link DropdownProps.children}. */
  readonly children: (props: InternalChildProps<T>) => ReactNode
}

/** Props for a {@link Dropdown} shared between all variants. */
interface InternalBaseDropdownProps<T> extends InternalChildrenProps<T> {
  readonly readOnly?: boolean
  readonly className?: string
}

/** Props for a {@link Dropdown}, when `multiple` is `false` or absent. */
interface InternalSingleDropdownProps<T> extends InternalBaseDropdownProps<T> {
  readonly multiple?: false
  readonly selectedIndex: number | null
  readonly onChange: (item: T, index: number) => void
}

/** Props for a {@link Dropdown}, when `multiple` is `true`. */
interface InternalMultipleDropdownProps<T> extends InternalBaseDropdownProps<T> {
  readonly multiple: true
  readonly selectedIndices: readonly number[]
  readonly renderMultiple: (props: InternalChildrenProps<T>) => ReactNode
  readonly onChange: (items: readonly T[], indices: readonly number[]) => void
}

/** Props for a {@link Dropdown}. */
export type DropdownProps<T> = InternalMultipleDropdownProps<T> | InternalSingleDropdownProps<T>

/** A styled dropdown. */
export const Dropdown = forwardRef(function Dropdown<T>(
  props: DropdownProps<T>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const { readOnly = false, className, items, children: Child } = props
  const listBoxItems = useMemo(() => items.map((item, i) => ({ item, i })), [items])
  const [tempSelectedIndex, setTempSelectedIndex] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const isFocusedRef = useSyncRef(isFocused)
  const shouldBlurRef = useRef(isFocused)
  const { focusWithinProps } = useFocusWithin({ onFocusWithinChange: setIsFocused })
  const multiple = props.multiple === true
  const selectedIndex = 'selectedIndex' in props ? props.selectedIndex : null
  const selectedIndices = 'selectedIndices' in props ? props.selectedIndices : []
  const selectedItems = selectedIndices.flatMap((index) => {
    const item = items[index]
    return item != null ? [item] : []
  })
  const visuallySelectedIndex = tempSelectedIndex ?? selectedIndex
  const visuallySelectedItem = visuallySelectedIndex == null ? null : items[visuallySelectedIndex]

  const styles = DROPDOWN_STYLES({ className, isFocused, isReadOnly: readOnly })

  useEffect(() => {
    setTempSelectedIndex(selectedIndex)
  }, [selectedIndex])

  useEffect(() => {
    const onDocumentClick = () => {
      if (shouldBlurRef.current) {
        rootRef.current?.blur()
      }
    }
    const onDocumentMouseDown = () => {
      shouldBlurRef.current = isFocusedRef.current
    }
    document.addEventListener('click', onDocumentClick)
    document.addEventListener('mousedown', onDocumentMouseDown)
    return () => {
      document.removeEventListener('click', onDocumentClick)
      document.removeEventListener('mousedown', onDocumentMouseDown)
    }
  }, [isFocusedRef])

  return (
    <FocusRing placement="outset">
      <div
        ref={mergeRefs(ref, rootRef)}
        {...mergeProps<JSX.IntrinsicElements['div']>()(focusWithinProps, {
          tabIndex: 0,
          className: styles.base(),
        })}
      >
        <div className={styles.container()}>
          <div className={styles.options()}>
            {/* Spacing. */}
            <div className={styles.optionsSpacing()} />
            <div className={styles.optionsContainer()}>
              <ListBox
                selectionMode={
                  !isFocused ? 'none'
                  : multiple ?
                    'multiple'
                  : 'single'
                }
                items={listBoxItems}
                dependencies={[selectedIndices]}
                className={styles.optionsList()}
                onSelectionChange={(keys) => {
                  if (multiple) {
                    const indices = Array.from(keys, (i) => Number(i))
                    props.onChange(
                      indices.flatMap((i) => {
                        const item = items[i]
                        return item === undefined ? [] : [item]
                      }),
                      indices,
                    )
                  } else {
                    const [key] = keys
                    if (key != null) {
                      const i = Number(key)
                      const item = items[i]
                      if (item !== undefined) {
                        props.onChange(item, i)
                      }
                    }
                  }
                }}
              >
                {({ item, i }) => (
                  <ListBoxItem key={i} id={i} className={styles.optionsItem()}>
                    <SvgMask
                      src={CheckMarkIcon}
                      className={selectedIndices.includes(i) ? '' : 'invisible'}
                    />
                    <Child item={item} />
                  </ListBoxItem>
                )}
              </ListBox>
            </div>
          </div>
        </div>
        <div className={styles.input()}>
          <SvgMask src={FolderArrowIcon} className="rotate-90" />
          <div className={styles.inputDisplay()}>
            {visuallySelectedItem != null ?
              <Child item={visuallySelectedItem} />
            : multiple && <props.renderMultiple items={selectedItems}>{Child}</props.renderMultiple>
            }
          </div>
        </div>
        {/* Hidden, but required to exist for the width of the parent element to be correct.
         * Classes that do not affect width have been removed. */}
        <div className={styles.hiddenOptions()}>
          {items.map((item, i) => (
            <div key={i} className={styles.hiddenOption()}>
              <SvgMask src={CheckMarkIcon} />
              <Child item={item} />
            </div>
          ))}
        </div>
      </div>
    </FocusRing>
  )
})
