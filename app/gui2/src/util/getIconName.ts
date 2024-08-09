import {
  SuggestionKind,
  type SuggestionEntry,
  type Typename,
} from '@/stores/suggestionDatabase/entry'
import type { Icon } from '@/util/iconName'
import type { MethodPointer } from 'ydoc-shared/languageServerTypes'

const typeNameToIconLookup: Record<string, Icon> = {
  'Standard.Base.Data.Text.Text': 'text_input',
  'Standard.Base.Data.Numbers.Integer': 'input_number',
  'Standard.Base.Data.Numbers.Float': 'input_number',
  'Standard.Base.Data.Array.Array': 'array_new',
  'Standard.Base.Data.Vector.Vector': 'array_new',
  'Standard.Base.Data.Time.Date.Date': 'calendar',
  'Standard.Base.Data.Time.Date_Time.Date_Time': 'calendar',
  'Standard.Base.Data.Time.Time_Of_Day.Time_Of_Day': 'time',
}

export const DEFAULT_ICON = 'enso_logo'

export function typeNameToIcon(typeName: string): Icon {
  return typeNameToIconLookup[typeName] ?? DEFAULT_ICON
}

export function suggestionEntryToIcon(entry: SuggestionEntry) {
  if (entry.iconName) return entry.iconName
  if (entry.kind === SuggestionKind.Local) return 'local_scope2'
  if (entry.kind === SuggestionKind.Module) return 'collection'
  return DEFAULT_ICON
}

export function displayedIconOf(
  entry?: SuggestionEntry,
  methodCall?: MethodPointer,
  actualType?: Typename,
): Icon {
  if (entry) {
    return suggestionEntryToIcon(entry)
  } else if (!methodCall?.name && actualType) {
    return typeNameToIcon(actualType)
  } else {
    return DEFAULT_ICON
  }
}
