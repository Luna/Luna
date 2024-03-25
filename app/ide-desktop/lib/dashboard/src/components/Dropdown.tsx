/** @file A styled dropdown. */
import * as React from 'react'

import CheckMarkIcon from 'enso-assets/check_mark.svg'
import FolderArrowIcon from 'enso-assets/folder_arrow.svg'

import SvgMask from '#/components/SvgMask'

// ================
// === Dropdown ===
// ================

/** Props for a list item child. */
interface InternalChildProps<T> {
  readonly item: T
}

/** Props for the display of the currently selected item, when the dropdown supports multiple children. */
interface InternalChildrenProps<T> {
  readonly items: T[]
  /** This is the value passed as {@link DropdownProps.render}. */
  readonly render: (props: InternalChildProps<T>) => React.ReactNode
}

/** Props for a {@link Dropdown} shared between all variants. */
interface InternalBaseDropdownProps<T> {
  readonly readOnly?: boolean
  readonly className?: string
  readonly items: readonly T[]
  readonly render: (props: InternalChildProps<T>) => React.ReactNode
}

/** Props for a {@link Dropdown}, when `multiple` is `false` or absent. */
interface InternalSingleDropdownProps<T> extends InternalBaseDropdownProps<T> {
  readonly multiple?: false
  readonly selectedIndex: number | null
  readonly onClick: (item: T, index: number) => void
}

/** Props for a {@link Dropdown}, when `multiple` is `true`. */
interface InternalMultipleDropdownProps<T> extends InternalBaseDropdownProps<T> {
  readonly multiple: true
  readonly selectedIndices: readonly number[]
  readonly renderMultiple: (props: InternalChildrenProps<T>) => React.ReactNode
  readonly onClick: (items: readonly T[], indices: readonly number[]) => void
}

/** Props for a {@link Dropdown}. */
export type DropdownProps<T> = InternalMultipleDropdownProps<T> | InternalSingleDropdownProps<T>

/** A styled dropdown. */
export default function Dropdown<T>(props: DropdownProps<T>) {
  const { readOnly = false, className, items, render: Child } = props
  const [isDropdownVisible, setIsDropdownVisible] = React.useState(false)
  const [tempSelectedIndex, setTempSelectedIndex] = React.useState<number | null>(null)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const justFocusedRef = React.useRef(false)
  const isMouseDown = React.useRef(false)
  const multiple = props.multiple === true
  const selectedIndex = 'selectedIndex' in props ? props.selectedIndex : null
  const selectedIndices = 'selectedIndices' in props ? props.selectedIndices : []
  const selectedItems = selectedIndices.flatMap(index => {
    const item = items[index]
    return item != null ? [item] : []
  })
  const visuallySelectedIndex = tempSelectedIndex ?? selectedIndex
  const visuallySelectedItem = visuallySelectedIndex == null ? null : items[visuallySelectedIndex]

  React.useEffect(() => {
    setTempSelectedIndex(selectedIndex)
  }, [selectedIndex])

  React.useEffect(() => {
    if (!isDropdownVisible) {
      rootRef.current?.blur()
    }
  }, [isDropdownVisible])

  React.useEffect(() => {
    const onDocumentClick = () => {
      setIsDropdownVisible(false)
    }
    document.addEventListener('click', onDocumentClick)
    return () => {
      document.removeEventListener('click', onDocumentClick)
    }
  }, [])

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
      switch (event.key) {
        case 'Escape': {
          event.stopPropagation()
          setIsDropdownVisible(false)
          break
        }
        case 'Enter':
        case 'Tab': {
          event.stopPropagation()
          if (tempSelectedIndex != null) {
            const item = items[tempSelectedIndex]
            if (item != null) {
              if (multiple) {
                const newIndices = selectedIndices.includes(tempSelectedIndex)
                  ? selectedIndices.filter(index => index !== tempSelectedIndex)
                  : [...selectedIndices, tempSelectedIndex]
                props.onClick(
                  newIndices.flatMap(index => {
                    const otherItem = items[index]
                    return otherItem != null ? [otherItem] : []
                  }),
                  newIndices
                )
              } else {
                props.onClick(item, tempSelectedIndex)
              }
            }
          }
          if (event.key !== 'Enter' || !multiple) {
            setIsDropdownVisible(false)
          }
          break
        }
        case 'ArrowUp': {
          event.preventDefault()
          setTempSelectedIndex(
            tempSelectedIndex == null ||
              tempSelectedIndex === 0 ||
              tempSelectedIndex >= items.length
              ? items.length - 1
              : tempSelectedIndex - 1
          )
          break
        }
        case 'ArrowDown': {
          event.preventDefault()
          setTempSelectedIndex(
            tempSelectedIndex == null || tempSelectedIndex >= items.length - 1
              ? 0
              : tempSelectedIndex + 1
          )
          break
        }
      }
    }
  }

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      className={`group relative flex w-max cursor-pointer flex-col items-start whitespace-nowrap rounded-input leading-cozy ${
        className ?? ''
      }`}
      onFocus={event => {
        if (!readOnly && event.target === event.currentTarget) {
          setIsDropdownVisible(true)
          justFocusedRef.current = true
        }
      }}
      onBlur={event => {
        // TODO: should not blur when `multiple` and clicking on option
        if (!readOnly && event.target === event.currentTarget) {
          setIsDropdownVisible(false)
        }
      }}
      onKeyDown={onKeyDown}
      onKeyUp={() => {
        justFocusedRef.current = false
      }}
      onClick={event => {
        event.stopPropagation()
      }}
    >
      <div
        className={`absolute left-0 h-full w-full min-w-max ${isDropdownVisible ? 'z-1' : 'overflow-hidden'}`}
      >
        <div
          className={`relative before:absolute before:top before:w-full before:rounded-input before:border before:border-primary/10 before:backdrop-blur-default before:transition-colors ${
            isDropdownVisible
              ? 'before:h-full before:shadow-soft'
              : 'before:h-text group-hover:before:bg-frame'
          }`}
        >
          {/* Spacing. */}
          <div
            className="padding relative h-text"
            onClick={event => {
              event.stopPropagation()
              if (!justFocusedRef.current && !readOnly) {
                setIsDropdownVisible(false)
              }
              justFocusedRef.current = false
            }}
          />
          <div
            className={`relative grid max-h-dropdown-items w-full overflow-auto rounded-input transition-grid-template-rows ${
              isDropdownVisible ? 'grid-rows-1fr' : 'grid-rows-0fr'
            }`}
          >
            <div className="overflow-hidden">
              {items.map((item, i) => (
                <div
                  tabIndex={-1}
                  className={`flex h-text items-center gap-dropdown-arrow rounded-input px-input-x transition-colors ${
                    multiple ? 'hover:font-semibold' : ''
                  } ${
                    i === visuallySelectedIndex
                      ? `cursor-default bg-frame font-bold`
                      : 'hover:bg-primary/10'
                  }`}
                  key={i}
                  onMouseDown={event => {
                    event.preventDefault()
                    isMouseDown.current = true
                  }}
                  onMouseUp={() => {
                    isMouseDown.current = false
                  }}
                  onClick={() => {
                    if (i !== visuallySelectedIndex) {
                      if (multiple) {
                        const newIndices = selectedIndices.includes(i)
                          ? selectedIndices.filter(index => index !== i)
                          : [...selectedIndices, i]
                        props.onClick(
                          newIndices.flatMap(index => {
                            const otherItem = items[index]
                            return otherItem != null ? [otherItem] : []
                          }),
                          newIndices
                        )
                        rootRef.current?.focus()
                      } else {
                        setIsDropdownVisible(false)
                        props.onClick(item, i)
                      }
                    }
                  }}
                  onFocus={() => {
                    if (!isMouseDown.current) {
                      // This is from keyboard navigation.
                      if (multiple) {
                        props.onClick([item], [i])
                      } else {
                        props.onClick(item, i)
                      }
                    }
                  }}
                >
                  <SvgMask
                    src={CheckMarkIcon}
                    className={selectedIndices.includes(i) ? '' : 'invisible'}
                  />
                  <Child item={item} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div
        className={`relative flex h-text items-center gap-dropdown-arrow px-input-x ${isDropdownVisible ? 'z-1' : ''} ${
          readOnly ? 'read-only' : ''
        }`}
        onClick={event => {
          event.stopPropagation()
          if (!justFocusedRef.current && !readOnly) {
            setIsDropdownVisible(false)
          }
          justFocusedRef.current = false
        }}
      >
        <SvgMask src={FolderArrowIcon} className="rotate-90" />
        <div className="grow">
          {visuallySelectedItem != null ? (
            <Child item={visuallySelectedItem} />
          ) : (
            multiple && <props.renderMultiple items={selectedItems} render={Child} />
          )}
        </div>
      </div>
      {/* Hidden, but required to exist for the width of the parent element to be correct.
       * Classes that do not affect width have been removed. */}
      <div className="flex h flex-col overflow-hidden">
        {items.map((item, i) => (
          <div
            key={i}
            className={`flex gap-dropdown-arrow px-input-x ${i === visuallySelectedIndex ? 'font-bold' : ''}`}
          >
            <SvgMask src={CheckMarkIcon} />
            <Child item={item} />
          </div>
        ))}
      </div>
    </div>
  )
}
