/** @file A hook returning a function to get the ordinal string of a number. */
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { useText } from '#/providers/TextProvider'
import { useMemo } from 'react'
import { useLocale } from 'react-aria'

/** A hook returning a function to get the ordinal string of a number. */
export function useGetOrdinal() {
  const { getText } = useText()
  const { locale } = useLocale()

  const pluralRules = useMemo(() => new Intl.PluralRules(locale, { type: 'ordinal' }), [locale])

  const suffixes = useMemo(
    () =>
      new Map([
        ['one', getText('pluralOne')],
        ['two', getText('pluralTwo')],
        ['few', getText('pluralFew')],
        ['other', getText('pluralOther')],
      ]),
    [getText],
  )

  return useEventCallback((n: number) => {
    const pluralRule = pluralRules.select(n)
    const suffix = suffixes.get(pluralRule)
    return `${n}${suffix}`
  })
}
