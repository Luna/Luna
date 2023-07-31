/** @file An entry in a context menu. */
import * as React from 'react'

import * as shortcutsModule from '../shortcuts'
import * as shortcutsProvider from '../../providers/shortcuts'

import KeyboardShortcut from './keyboardShortcut'
import SvgMask from '../../authentication/components/svgMask'

// ========================
// === ContextMenuEntry ===
// ========================

/** Props for a {@link ContextMenuEntry}. */
export interface ContextMenuEntryProps {
    action: shortcutsModule.KeyboardAction
    disabled?: boolean
    title?: string
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}

/** An item in a `ContextMenu`. */
export default function ContextMenuEntry(props: ContextMenuEntryProps) {
    const { action, disabled = false, title, onClick } = props
    const { shortcuts } = shortcutsProvider.useShortcuts()
    const info = shortcuts.keyboardShorcutInfo[action]
    return (
        <button
            disabled={disabled}
            title={title}
            className="flex items-center place-content-between h-8 p-1 hover:bg-black-a10 first:rounded-t-2xl last:rounded-b-2xl text-left disabled:opacity-50"
            onClick={event => {
                event.stopPropagation()
                onClick(event)
            }}
        >
            <div className="flex items-center gap-3">
                <SvgMask src={info.icon} className={info.colorClass} />
                {info.name}
            </div>
            <KeyboardShortcut action={action} />
        </button>
    )
}
