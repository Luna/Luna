/** @file Switcher to choose the currently visible full-screen page. */
import * as React from 'react'

import * as tailwindMerge from 'tailwind-merge'

import DriveIcon from 'enso-assets/drive.svg'
import WorkspaceIcon from 'enso-assets/workspace.svg'

import type * as text from '#/text'

import * as textProvider from '#/providers/TextProvider'

import * as aria from '#/components/aria'
import * as ariaComponents from '#/components/AriaComponents'
import FocusArea from '#/components/styled/FocusArea'
import SvgMask from '#/components/SvgMask'

// ============
// === Page ===
// ============

/** Main content of the screen. Only one should be visible at a time. */
export enum Page {
  drive = 'drive',
  editor = 'editor',
  settings = 'settings',
}

// =================
// === Constants ===
// =================

/** Configuration flag determining whether to show the close button.
 * This is present in order to match the Figma design as closely as possible. */
const SHOW_CLOSE_BUTTON: boolean = false

const PAGE_DATA: PageUIData[] = [
  { page: Page.drive, icon: DriveIcon, nameId: 'drivePageName' },
  { page: Page.editor, icon: WorkspaceIcon, nameId: 'editorPageName' },
]

//===================
// === PageUIData ===
//===================

/** Data describing how to display a button for a page. */
interface PageUIData {
  readonly page: Page
  readonly icon: string
  readonly nameId: Extract<text.TextId, `${Page}PageName`>
}

// ====================
// === PageSwitcher ===
// ====================

/** Props for a {@link PageSwitcher}. */
export interface PageSwitcherProps {
  readonly page: Page
  readonly setPage: (page: Page) => void
  readonly isEditorDisabled: boolean
}

/** Switcher to choose the currently visible full-screen page. */
export default function PageSwitcher(props: PageSwitcherProps) {
  const { page, setPage, isEditorDisabled } = props
  const { getText } = textProvider.useText()
  const selectedChildIndexRef = React.useRef(0)
  const lastChildIndexRef = React.useRef(0)
  const pageIndexRaw = PAGE_DATA.findIndex(pageData => page === pageData.page)
  const pageIndex = pageIndexRaw === -1 ? null : pageIndexRaw
  const isLastPageSelected = pageIndexRaw === PAGE_DATA.length - 1

  React.useEffect(() => {
    selectedChildIndexRef.current = PAGE_DATA.findIndex(data => data.page === page)
  }, [page])

  React.useEffect(() => {
    if (isEditorDisabled) {
      lastChildIndexRef.current = PAGE_DATA.length - 2
    } else {
      lastChildIndexRef.current = PAGE_DATA.length - 1
    }
  }, [isEditorDisabled])

  const closeWindow = () => {
    window.close()
  }

  return (
    <FocusArea direction="horizontal">
      {innerProps => (
        <div
          className="pointer-events-auto flex h-12 shrink-0 grow cursor-default items-center rounded-full"
          {...innerProps}
        >
          {SHOW_CLOSE_BUTTON && (
            <div
              className={tailwindMerge.twMerge(
                'flex bg-primary/5 py-[18px] pl-[19px] pr-[29px]',
                pageIndex === 0 && 'rounded-br-3xl'
              )}
            >
              <ariaComponents.CloseButton onPress={closeWindow} />
            </div>
          )}
          {PAGE_DATA.map((pageData, i) => {
            const active = page === pageData.page
            return (
              <div
                key={pageData.page}
                className={tailwindMerge.twMerge(
                  'h-full pr-4 transition-[padding-left]',
                  page === pageData.page
                    ? 'pl-[19px]'
                    : 'bg-primary/5 pl-4 hover:enabled:bg-primary/[2.5%]',
                  active && 'rounded-t-3xl outline outline-[1rem] outline-primary/5 clip-path-0',
                  pageIndex != null && i === pageIndex + 1 && 'rounded-bl-3xl',
                  pageIndex != null && i === pageIndex - 1 && 'rounded-br-3xl'
                )}
              >
                <ariaComponents.Button
                  className={tailwindMerge.twMerge(
                    'flex h-full items-center gap-3 selectable',
                    active && 'disabled active'
                  )}
                  isDisabled={pageData.page === Page.editor && isEditorDisabled}
                  onPress={() => {
                    setPage(pageData.page)
                  }}
                >
                  <SvgMask src={pageData.icon} />
                  <aria.Text className="text">{getText(pageData.nameId)}</aria.Text>
                </ariaComponents.Button>
              </div>
            )
          })}
          <div
            className={tailwindMerge.twMerge(
              'h-full grow bg-primary/5',
              isLastPageSelected && 'rounded-bl-3xl'
            )}
          />
        </div>
      )}
    </FocusArea>
  )
}
