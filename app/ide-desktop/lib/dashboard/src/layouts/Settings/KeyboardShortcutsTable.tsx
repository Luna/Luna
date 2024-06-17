/** @file Settings tab for viewing and editing keyboard shortcuts. */
import * as React from 'react'

import BlankIcon from 'enso-assets/blank.svg'
import CrossIcon from 'enso-assets/cross.svg'
import Plus2Icon from 'enso-assets/plus2.svg'
import ReloadInCircleIcon from 'enso-assets/reload_in_circle.svg'

import type * as refreshHooks from '#/hooks/refreshHooks'
import * as scrollHooks from '#/hooks/scrollHooks'

import * as inputBindingsManager from '#/providers/InputBindingsProvider'
import * as modalProvider from '#/providers/ModalProvider'
import * as textProvider from '#/providers/TextProvider'

import KeyboardShortcutsSettingsTabBar from '#/layouts/Settings/KeyboardShortcutsSettingsTabBar'

import * as aria from '#/components/aria'
import * as ariaComponents from '#/components/AriaComponents'
import KeyboardShortcut from '#/components/dashboard/KeyboardShortcut'
import FocusArea from '#/components/styled/FocusArea'
import SvgMask from '#/components/SvgMask'

import CaptureKeyboardShortcutModal from '#/modals/CaptureKeyboardShortcutModal'

import * as object from '#/utilities/object'

// ==============================
// === KeyboardShortcutsTable ===
// ==============================

/** Props for a {@link KeyboardShortcutsSettingsTabBar}. */
export interface KeyboardShortcutsTableProps {
  readonly refresh: refreshHooks.RefreshState
  readonly doRefresh: () => void
}

/** Settings tab for viewing and editing keyboard shortcuts. */
export default function KeyboardShortcutsTable(props: KeyboardShortcutsTableProps) {
  const { refresh, doRefresh } = props
  const inputBindings = inputBindingsManager.useInputBindings()
  const { setModal } = modalProvider.useSetModal()
  const { getText } = textProvider.useText()
  const rootRef = React.useRef<HTMLDivElement>(null)
  const bodyRef = React.useRef<HTMLTableSectionElement>(null)
  const allShortcuts = React.useMemo(() => {
    // This is REQUIRED, in order to avoid disabling the `react-hooks/exhaustive-deps` lint.
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    refresh
    return new Set(Object.values(inputBindings.metadata).flatMap(value => value.bindings))
  }, [inputBindings.metadata, refresh])
  const visibleBindings = React.useMemo(
    () => object.unsafeEntries(inputBindings.metadata).filter(kv => kv[1].rebindable !== false),
    [inputBindings.metadata]
  )

  const { onScroll } = scrollHooks.useStickyTableHeaderOnScroll(rootRef, bodyRef)

  return (
    // There is a horizontal scrollbar for some reason without `px-px`.
    // eslint-disable-next-line no-restricted-syntax
    <FocusArea direction="vertical" focusChildClass="focus-default" focusDefaultClass="">
      {innerProps => (
        <div
          {...aria.mergeProps<JSX.IntrinsicElements['div']>()(innerProps, {
            ref: rootRef,
            className: 'overflow-auto px-px',
            onScroll,
          })}
        >
          <table className="table-fixed border-collapse rounded-rows">
            <thead className="sticky top">
              <tr className="h-row text-left text-sm font-semibold">
                <th className="pr-keyboard-shortcuts-icon-column-r min-w-keyboard-shortcuts-icon-column pl-cell-x">
                  {/* Icon */}
                </th>
                <th className="min-w-keyboard-shortcuts-name-column px-cell-x">
                  {getText('name')}
                </th>
                <th className="px-cell-x">{getText('shortcuts')}</th>
                <th className="w-full px-cell-x">{getText('description')}</th>
              </tr>
            </thead>
            <tbody ref={bodyRef}>
              {visibleBindings.map(kv => {
                const [action, info] = kv
                return (
                  <tr key={action} className="rounded-rows-child">
                    <td className="flex h-row items-center rounded-l-full bg-clip-padding pl-cell-x pr-icon-column-r">
                      <SvgMask src={info.icon ?? BlankIcon} color={info.color} className="size-4" />
                    </td>
                    <td className="border-l-2 border-r-2 border-transparent bg-clip-padding px-cell-x">
                      {info.name}
                    </td>
                    <td className="group min-w-max border-l-2 border-r-2 border-transparent bg-clip-padding px-cell-x">
                      <FocusArea direction="horizontal">
                        {bindingsProps => (
                          <div {...bindingsProps}>
                            {/* I don't know why this padding is needed,
                             * given that this is a flex container. */}
                            {/* eslint-disable-next-line no-restricted-syntax */}
                            <div className="flex gap-buttons pr-4">
                              {info.bindings.map((binding, j) => (
                                <div
                                  key={j}
                                  className="inline-flex shrink-0 items-center gap-keyboard-shortcuts-button"
                                >
                                  <KeyboardShortcut shortcut={binding} />
                                  <ariaComponents.Button
                                    size="custom"
                                    variant="custom"
                                    className="flex rounded-full transition-colors hover:bg-hover-bg focus:bg-hover-bg"
                                    onPress={() => {
                                      inputBindings.delete(action, binding)
                                      doRefresh()
                                    }}
                                  >
                                    <SvgMask src={CrossIcon} className="size-4" />
                                  </ariaComponents.Button>
                                </div>
                              ))}
                              <div className="gap-keyboard-shortcuts-buttons flex shrink-0">
                                <ariaComponents.Button
                                  size="custom"
                                  variant="custom"
                                  className="focus-default my-auto flex rounded-full"
                                  onPress={() => {
                                    setModal(
                                      <CaptureKeyboardShortcutModal
                                        description={`'${info.name}'`}
                                        existingShortcuts={allShortcuts}
                                        onSubmit={shortcut => {
                                          inputBindings.add(action, shortcut)
                                          doRefresh()
                                        }}
                                      />
                                    )
                                  }}
                                >
                                  <img className="size-plus-icon" src={Plus2Icon} />
                                </ariaComponents.Button>
                                <ariaComponents.Button
                                  size="custom"
                                  variant="custom"
                                  className="my-auto flex rounded-full"
                                  onPress={() => {
                                    inputBindings.reset(action)
                                    doRefresh()
                                  }}
                                >
                                  <img className="size-plus-icon" src={ReloadInCircleIcon} />
                                </ariaComponents.Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </FocusArea>
                    </td>
                    <td className="cell-x rounded-r-full border-l-2 border-r-2 border-transparent bg-clip-padding">
                      {info.description}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </FocusArea>
  )
}
