/** @file Community updates for the app. */
import * as React from 'react'

import DiscordIcon from 'enso-assets/discord.svg'
import IntegrationsImage from 'enso-assets/integrations.png'
import YoutubeIcon from 'enso-assets/youtube.svg'

import * as keyboardNavigationHooks from '#/hooks/keyboardNavigationHooks'

import * as navigator2DProvider from '#/providers/Navigator2DProvider'

// ================
// === WhatsNew ===
// ================

/** Community updates for the app. */
export default function WhatsNew() {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const navigator2D = navigator2DProvider.useNavigator2D()

  const [keyboardSelectedIndex, setKeyboardSelectedIndex] =
    keyboardNavigationHooks.useKeyboardChildNavigation(rootRef, {
      axis: keyboardNavigationHooks.Axis.horizontal,
      length: 3,
    })

  React.useEffect(() => {
    const root = rootRef.current
    if (root == null) {
      return
    } else {
      return navigator2D.register(root, {
        focusPrimaryChild: setKeyboardSelectedIndex.bind(null, 0),
      })
    }
  }, [navigator2D, setKeyboardSelectedIndex])

  return (
    <div ref={rootRef} className="flex flex-col gap-subheading px-home-section-x">
      <h2 className="text-subheading">Discover what&rsquo;s new</h2>
      <div className="grid grid-cols-fill-news-items gap-news-items">
        <a
          ref={element => {
            if (keyboardSelectedIndex === 0) {
              element?.focus()
            }
          }}
          className={`relative col-span-1 h-news-item rounded-default bg-v3 text-tag-text col-span-2-news-item sm:col-span-2 ${keyboardSelectedIndex === 2 ? 'focus-ring' : ''}`}
          rel="noreferrer"
          target="_blank"
          href="https://enso.org/"
          style={{ background: `url(${IntegrationsImage}) top -85px right -390px / 1055px` }}
        >
          <div className="absolute bottom flex w-full flex-col p-news-item-description">
            <span className="text-subheading font-bold">
              Read what&rsquo;s new in Enso 3.0 Beta
            </span>
            <span className="py-news-item-subtitle-y text-sm leading-snug">
              Learn about Enso Cloud, new data libraries, and Enso AI.
            </span>
          </div>
        </a>
        <a
          ref={element => {
            if (keyboardSelectedIndex === 1) {
              element?.focus()
            }
          }}
          className={`relative h-news-item rounded-default bg-youtube text-tag-text ${keyboardSelectedIndex === 1 ? 'focus-ring' : ''}`}
          rel="noreferrer"
          target="_blank"
          href="https://www.youtube.com/c/Enso_org"
        >
          <img className="absolute left-1/2 top-6 mx-auto -translate-x-1/2" src={YoutubeIcon} />
          <div className="absolute bottom flex w-full flex-col p-news-item-description">
            <span className="text-subheading font-bold">Watch weekly Enso tutorials</span>
            <span className="py-news-item-subtitle-y text-sm leading-snug">
              Subscribe not to miss new weekly tutorials.
            </span>
          </div>
        </a>
        <a
          ref={element => {
            if (keyboardSelectedIndex === 2) {
              element?.focus()
            }
          }}
          className={`relative h-news-item rounded-default bg-discord text-tag-text ${keyboardSelectedIndex === 2 ? 'focus-ring' : ''}`}
          rel="noreferrer"
          target="_blank"
          href="https://discord.gg/enso"
        >
          <img className="absolute left-1/2 top-7 mx-auto -translate-x-1/2" src={DiscordIcon} />
          <div className="absolute bottom flex w-full flex-col p-news-item-description">
            <span className="text-subheading font-bold">Join our community server</span>
            <span className="py-news-item-subtitle-y text-sm leading-snug">
              Chat with our team and other Enso users.
            </span>
          </div>
        </a>
      </div>
    </div>
  )
}
