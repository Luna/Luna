/** @file A hook returning a function to get the ordinal string of a number. */
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { useText } from '#/providers/TextProvider'
import type { TextId } from 'enso-common/src/text'
import { includes } from 'enso-common/src/utilities/data/array'
import { unsafeKeys } from 'enso-common/src/utilities/data/object'

/** Remove the `"ordinal"` prefix from a string. */
type StripOrdinalString<T> = T extends `ordinal${infer Number}` ? Number : never
/** {@link TextId}s correspoding to ordinal numbers. */
type OrdinalTextId = TextId & `ordinal${number}`
/** Numbers with corresponding ordinals. */
type NumberWithOrdinal = StripOrdinalString<OrdinalTextId>

const ORDINAL_LOOKUP: { readonly [K in NumberWithOrdinal]: TextId & `ordinal${K}` } = {
  /* eslint-disable @typescript-eslint/naming-convention */
  '1': 'ordinal1',
  '2': 'ordinal2',
  '3': 'ordinal3',
  '4': 'ordinal4',
  '5': 'ordinal5',
  '6': 'ordinal6',
  '7': 'ordinal7',
  '8': 'ordinal8',
  '9': 'ordinal9',
  '10': 'ordinal10',
  '11': 'ordinal11',
  '12': 'ordinal12',
  '13': 'ordinal13',
  '14': 'ordinal14',
  '15': 'ordinal15',
  '16': 'ordinal16',
  '17': 'ordinal17',
  '18': 'ordinal18',
  '19': 'ordinal19',
  '20': 'ordinal20',
  '21': 'ordinal21',
  '22': 'ordinal22',
  '23': 'ordinal23',
  '24': 'ordinal24',
  '25': 'ordinal25',
  '26': 'ordinal26',
  '27': 'ordinal27',
  '28': 'ordinal28',
  '29': 'ordinal29',
  '30': 'ordinal30',
  '31': 'ordinal31',
  /* eslint-enable @typescript-eslint/naming-convention */
}

const ORDINAL_STRINGS = unsafeKeys(ORDINAL_LOOKUP)

/** A hook returning a function to get the ordinal string of a number. */
export function useGetOrdinal() {
  const { getText } = useText()
  return useEventCallback((n: number) => {
    const nString = `${n}`
    return includes(ORDINAL_STRINGS, nString) ?
        getText(ORDINAL_LOOKUP[nString])
      : getText('ordinalFallback', n)
  })
}
