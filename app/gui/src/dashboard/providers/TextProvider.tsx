/**
 * @file The React provider for localized, along with hooks to use the provider via the shared
 * React context.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

import { unsafeMutable } from '@common/utilities/data/object'
import {
  Language,
  LANGUAGE_TO_LOCALE,
  TEXTS,
  type Replacements,
  type TextId,
} from '../../../../common/src/text'

/** State contained in a `TextContext`. */
export interface TextContextType {
  readonly language: Language
  readonly locale: string
  readonly setLanguage: (newLanguage: Language) => void
}

/**
 * A function that gets localized text for a given key, with optional replacements.
 * @param key - The key of the text to get.
 * @param replacements - The replacements to insert into the text.
 * If the text contains placeholders like `$0`, `$1`, etc.,
 * they will be replaced with the corresponding replacement.
 */
export type GetText = <K extends TextId>(key: K, ...replacements: Replacements[K]) => string

const DEFAULT_LANGUAGE = Language.english

const TextContext = createContext<TextContextType>({
  language: DEFAULT_LANGUAGE,
  locale: LANGUAGE_TO_LOCALE[DEFAULT_LANGUAGE],
  /**
   * Set `this.language`. It is NOT RECOMMENDED to use the default value, as this does not trigger
   * reactive updates.
   */
  setLanguage(language) {
    unsafeMutable(this).language = language
  },
})

/** Props for a {@link TextProvider}. */
export type TextProviderProps = Readonly<PropsWithChildren>

/** A React Provider that lets components get the current language. */
export default function TextProvider(props: TextProviderProps) {
  const { children } = props

  const [language, setLanguage] = useState(Language.english)
  const locale = LANGUAGE_TO_LOCALE[language]

  const contextValue = useMemo<TextContextType>(
    () => ({ language, setLanguage, locale }),
    [language, locale],
  )

  return <TextContext.Provider value={contextValue}>{children}</TextContext.Provider>
}

/** Exposes a property to get localized text, and get and set the current language. */
export function useText() {
  const { language, setLanguage, locale } = useContext(TextContext)
  const localizedText = TEXTS[language]

  const getText = useCallback<GetText>(
    (key, ...replacements) => {
      const template = localizedText[key]
      return replacements.length === 0 ?
          template
        : template.replace(/[$]([$]|\d+)/g, (_match, placeholder: string) =>
            placeholder === '$' ? '$' : (
              String(replacements[Number(placeholder)] ?? `$${placeholder}`)
            ),
          )
    },
    [localizedText],
  )

  return { language, setLanguage, getText, locale } as const
}
