/** @file A bar containing clickable reactions. */
import * as React from 'react'

import Twemoji from '#/components/Twemoji'

// =================
// === Constants ===
// =================

/** The size (both width and height) of each reaction button. */
const REACTION_BUTTON_SIZE = 20
/** The list of reaction emojis, in order. */
const REACTION_EMOJIS = ['❤️', '👍', '👎', '😀', '🙁', '👀', '🎉'] as const

// =============
// === Types ===
// =============

/** All possible reactions. */
export type ReactionSymbol = (typeof REACTION_EMOJIS)[number]

// ===================
// === ReactionBar ===
// ===================

/** Props for a {@link ReactionBar}. */
export interface ReactionBarProps {
  readonly selectedReactions: Set<ReactionSymbol>
  readonly doReact: (reaction: ReactionSymbol) => void
  readonly doRemoveReaction: (reaction: ReactionSymbol) => void
  readonly className?: string
}

/** A list of emoji reactions to choose from. */
export default function ReactionBar(props: ReactionBarProps) {
  const { selectedReactions, doReact, doRemoveReaction, className } = props

  return (
    <div className={`inline-block bg-white rounded-full m-1 ${className ?? ''}`}>
      {REACTION_EMOJIS.map(emoji => (
        <button
          key={emoji}
          onClick={() => {
            if (selectedReactions.has(emoji)) {
              doRemoveReaction(emoji)
            } else {
              doReact(emoji)
            }
          }}
          // FIXME: Grayscale has the wrong lightness
          className={`rounded-full hover:bg-gray-200 m-1 p-1 ${
            selectedReactions.has(emoji) ? '' : 'opacity-70 grayscale hover:grayscale-0'
          }`}
        >
          <Twemoji key={emoji} emoji={emoji} size={REACTION_BUTTON_SIZE} />
        </button>
      ))}
    </div>
  )
}
