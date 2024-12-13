/** @file A search bar containing a text input, and a list of suggestions. */
import {
  memo,
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type MutableRefObject,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefAttributes,
  type RefObject,
  type SetStateAction,
} from 'react'

import { AnimatePresence, motion } from 'framer-motion'

import { isOnMacOS } from 'enso-common/src/detect'
import type { Backend, Label as BackendLabel } from 'enso-common/src/services/Backend'
import { shallowEqual } from 'enso-common/src/utilities/data/array'
import { compareCaseInsensitive } from 'enso-common/src/utilities/data/string'

import FindIcon from '#/assets/find.svg'
import {
  Button as AriaButton,
  Label as AriaLabel,
  Input,
  mergeProps,
  SearchField,
  type KeyboardEvent as AriaKeyboardEvent,
  type LabelProps,
  type PressEvent,
} from '#/components/aria'
import { Button, DIALOG_BACKGROUND, Text } from '#/components/AriaComponents'
import Label from '#/components/dashboard/Label'
import FocusArea from '#/components/styled/FocusArea'
import FocusRing from '#/components/styled/FocusRing'
import SvgMask from '#/components/SvgMask'
import { useBackendQuery } from '#/hooks/backendHooks'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { useSyncRef } from '#/hooks/syncRefHooks'
import { useModalRef } from '#/providers/ModalProvider'
import { useText } from '#/providers/TextProvider'
import AssetQuery from '#/utilities/AssetQuery'
import { isElementTextInput, isPotentiallyShortcut, isTextInputEvent } from '#/utilities/event'
import { twMerge } from '#/utilities/tailwindMerge'
import { unsafeWriteValue } from '#/utilities/write'
import { createStore, useStore } from '#/utilities/zustand'

/** The reason behind a new query. */
enum QuerySource {
  /**
   * A query change initiated by tabbing. While *technically* internal, it is semantically
   * different in that tabbing does not update the base query.
   */
  tabbing = 'tabbing',
  /** A query change initiated from code in this component. */
  internal = 'internal',
  /** A query change initiated by typing in the search bar. */
  typing = 'typing',
  /** A query change initiated from code in another component. */
  external = 'external',
}

/** A suggested query. */
export interface Suggestion {
  readonly key: string
  readonly render: () => ReactNode
  readonly addToQuery: (query: AssetQuery) => AssetQuery
  readonly deleteFromQuery: (query: AssetQuery) => AssetQuery
}

/** Props for a {@link Tags}. */
interface InternalTagsProps {
  readonly isCloud: boolean
  readonly querySource: MutableRefObject<QuerySource>
  readonly query: AssetQuery
  readonly setQuery: Dispatch<SetStateAction<AssetQuery>>
}

export const searchbarSuggestionsStore = createStore<{
  readonly suggestions: readonly Suggestion[]
  readonly setSuggestions: (suggestions: readonly Suggestion[]) => void
}>((set) => ({
  suggestions: [],
  setSuggestions: (suggestions) => {
    set({ suggestions })
  },
}))

/**
 * Sets the suggestions.
 */
export function useSetSuggestions() {
  return useStore(searchbarSuggestionsStore, (state) => state.setSuggestions, {
    unsafeEnableTransition: true,
  })
}

/** Tags (`name:`, `modified:`, etc.) */
function Tags(props: InternalTagsProps) {
  const { isCloud, querySource, query, setQuery } = props
  const [isShiftPressed, setIsShiftPressed] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      setIsShiftPressed(event.shiftKey)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      setIsShiftPressed(event.shiftKey)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  return (
    <div
      data-testid="asset-search-tag-names"
      className="pointer-events-auto flex flex-wrap gap-2 whitespace-nowrap px-1.5"
    >
      {(isCloud ? AssetQuery.tagNames : AssetQuery.localTagNames).flatMap((entry) => {
        const [key, tag] = entry
        return tag == null || isShiftPressed !== tag.startsWith('-') ?
            []
          : [
              <FocusRing key={key}>
                <Button
                  variant="outline"
                  size="xsmall"
                  className="min-w-12"
                  onPress={() => {
                    unsafeWriteValue(querySource, 'current', QuerySource.internal)
                    setQuery(query.add({ [key]: [[]] }))
                  }}
                >
                  {tag + ':'}
                </Button>
              </FocusRing>,
            ]
      })}
    </div>
  )
}

// ======================
// === AssetSearchBar ===
// ======================

/** Props for a {@link AssetSearchBar}. */
export interface AssetSearchBarProps {
  readonly backend: Backend | null
  readonly isCloud: boolean
  readonly query: AssetQuery
  readonly setQuery: Dispatch<SetStateAction<AssetQuery>>
}

/** A search bar containing a text input, and a list of suggestions. */
function AssetSearchBar(props: AssetSearchBarProps) {
  const { backend, isCloud, query, setQuery } = props
  const { modalRef } = useModalRef()
  /** A cached query as of the start of tabbing. */
  const baseQuery = useRef(query)

  const rawSuggestions = useStore(searchbarSuggestionsStore, (state) => state.suggestions, {
    unsafeEnableTransition: true,
  })

  const [suggestions, setSuggestions] = useState(rawSuggestions)

  const suggestionsRef = useSyncRef(suggestions)

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [areSuggestionsVisible, privateSetAreSuggestionsVisible] = useState(false)
  const areSuggestionsVisibleRef = useRef(areSuggestionsVisible)
  const querySource = useRef(QuerySource.external)
  const rootRef = useRef<HTMLLabelElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)

  const setAreSuggestionsVisible = useEventCallback((value: boolean) => {
    startTransition(() => {
      privateSetAreSuggestionsVisible(value)
      areSuggestionsVisibleRef.current = value
    })
  })

  useEffect(() => {
    if (querySource.current !== QuerySource.tabbing) {
      setSuggestions(rawSuggestions)
      unsafeWriteValue(suggestionsRef, 'current', rawSuggestions)
    }
  }, [rawSuggestions, suggestionsRef])

  useEffect(() => {
    if (querySource.current !== QuerySource.tabbing) {
      baseQuery.current = query
    }
    // This effect MUST only run when `query` changes.
  }, [query])

  useEffect(() => {
    if (querySource.current !== QuerySource.tabbing) {
      setSelectedIndex(null)
    }
    if (
      querySource.current !== QuerySource.internal &&
      querySource.current !== QuerySource.tabbing
    ) {
      if (searchRef.current != null) {
        searchRef.current.value = query.query
      }
    }
  }, [query])

  const selectedIndexDeps = useSyncRef({ query, setQuery, suggestions })

  useEffect(() => {
    const deps = selectedIndexDeps.current
    if (
      querySource.current === QuerySource.internal ||
      querySource.current === QuerySource.tabbing
    ) {
      let newQuery = deps.query
      const suggestion = selectedIndex == null ? null : deps.suggestions[selectedIndex]
      if (suggestion != null) {
        newQuery = suggestion.addToQuery(baseQuery.current)
        deps.setQuery(newQuery)
      }
      searchRef.current?.focus()
      const end = searchRef.current?.value.length ?? 0
      searchRef.current?.setSelectionRange(end, end)
      if (searchRef.current != null) {
        searchRef.current.value = newQuery.toString()
      }
    }
  }, [selectedIndex, selectedIndexDeps])

  useEffect(() => {
    const onSearchKeyDown = (event: KeyboardEvent) => {
      if (areSuggestionsVisibleRef.current) {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault()
          event.stopImmediatePropagation()
          querySource.current = QuerySource.tabbing
          const reverse = event.key === 'ArrowUp'
          setSelectedIndex((oldIndex) => {
            const length = Math.max(1, suggestionsRef.current.length)
            if (reverse) {
              return oldIndex == null ? length - 1 : (oldIndex + length - 1) % length
            } else {
              return oldIndex == null ? 0 : (oldIndex + 1) % length
            }
          })
        }
        if (
          event.key === 'Enter' ||
          (event.key === ' ' && document.activeElement !== searchRef.current)
        ) {
          querySource.current = QuerySource.external
          if (searchRef.current != null) {
            searchRef.current.focus()
            const end = searchRef.current.value.length
            searchRef.current.setSelectionRange(end, end)
          }
        }
        if (event.key === 'Enter') {
          setAreSuggestionsVisible(false)
        }
        if (event.key === 'Escape') {
          if (querySource.current === QuerySource.tabbing) {
            querySource.current = QuerySource.external
            setQuery(baseQuery.current)
            setAreSuggestionsVisible(false)
          } else {
            searchRef.current?.blur()
          }
        }
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      // Allow `alt` key to be pressed in case it is being used to enter special characters.
      if (
        !isElementTextInput(event.target) &&
        (!(event.target instanceof Node) || rootRef.current?.contains(event.target) !== true) &&
        isTextInputEvent(event) &&
        event.key !== ' ' &&
        (!isOnMacOS() || event.key !== 'Delete') &&
        modalRef.current == null
      ) {
        searchRef.current?.focus()
      }
      if (
        event.target instanceof Node &&
        rootRef.current?.contains(event.target) === true &&
        isPotentiallyShortcut(event)
      ) {
        searchRef.current?.focus()
      }
    }
    const root = rootRef.current
    root?.addEventListener('keydown', onSearchKeyDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      root?.removeEventListener('keydown', onSearchKeyDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [setQuery, modalRef, setAreSuggestionsVisible, suggestionsRef])

  // Reset `querySource` after all other effects have run.
  useEffect(() => {
    if (querySource.current !== QuerySource.typing && searchRef.current != null) {
      searchRef.current.value = query.toString()
    }
    if (querySource.current !== QuerySource.tabbing) {
      baseQuery.current = query
      querySource.current = QuerySource.external
    }
  }, [query, setQuery])

  const onSearchFieldKeyDown = useEventCallback((event: AriaKeyboardEvent) => {
    event.continuePropagation()
  })

  const searchFieldOnChange = useEventCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (querySource.current !== QuerySource.internal) {
      querySource.current = QuerySource.typing
      setQuery(AssetQuery.fromString(event.target.value))
    }
  })

  const searchInputOnKeyDown = useEventCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.altKey &&
      !event.metaKey &&
      !event.ctrlKey
    ) {
      // Clone the query to refresh results.
      setQuery(query.clone())
    }
  })

  const deferredSuggestions = useDeferredValue(suggestions)

  return (
    <FocusArea direction="horizontal">
      {(innerProps) => (
        <div className="relative w-full max-w-[60em]">
          <AriaLabel
            data-testid="asset-search-bar"
            {...mergeProps<LabelProps & RefAttributes<HTMLLabelElement>>()(innerProps, {
              className:
                'z-1 group flex grow items-center gap-asset-search-bar rounded-full px-1.5 py-1 text-primary border-0.5 border-primary/20',
              ref: rootRef,
              onFocus: () => {
                setAreSuggestionsVisible(true)
              },
              onBlur: (event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  if (querySource.current === QuerySource.tabbing) {
                    querySource.current = QuerySource.external
                  }
                  setAreSuggestionsVisible(false)
                }
              },
            })}
          >
            <div className="relative size-4 placeholder" />

            <AssetSearchBarPopover
              areSuggestionsVisible={areSuggestionsVisible}
              isCloud={isCloud}
              querySource={querySource}
              query={query}
              setQuery={setQuery}
              suggestions={deferredSuggestions}
              selectedIndex={selectedIndex}
              setAreSuggestionsVisible={setAreSuggestionsVisible}
              baseQuery={baseQuery}
              backend={backend}
            />

            <SvgMask
              src={FindIcon}
              className="absolute left-2 top-[50%] z-1 mt-[1px] -translate-y-1/2 text-primary/40"
            />

            <AssetSearchBarInput
              query={query}
              isCloud={isCloud}
              onSearchFieldKeyDown={onSearchFieldKeyDown}
              searchRef={searchRef}
              searchFieldOnChange={searchFieldOnChange}
              searchInputOnKeyDown={searchInputOnKeyDown}
            />
          </AriaLabel>
        </div>
      )}
    </FocusArea>
  )
}

/** Props for a {@link AssetSearchBarInput}. */
interface AssetSearchBarInputProps {
  readonly query: AssetQuery
  readonly isCloud: boolean
  readonly onSearchFieldKeyDown: (event: AriaKeyboardEvent) => void
  readonly searchRef: RefObject<HTMLInputElement>
  readonly searchFieldOnChange: (event: ChangeEvent<HTMLInputElement>) => void
  readonly searchInputOnKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void
}

/**
 * Renders the search field.
 */
// eslint-disable-next-line no-restricted-syntax
const AssetSearchBarInput = memo(function AssetSearchBarInput(props: AssetSearchBarInputProps) {
  const {
    query,
    isCloud,
    onSearchFieldKeyDown,
    searchRef,
    searchFieldOnChange,
    searchInputOnKeyDown,
  } = props
  const { getText } = useText()
  return (
    <>
      <FocusRing placement="before">
        <SearchField
          aria-label={getText('assetSearchFieldLabel')}
          className="relative grow before:text before:absolute before:-inset-x-1 before:my-auto before:rounded-full before:transition-all"
          value={query.query}
          onKeyDown={onSearchFieldKeyDown}
        >
          <Input
            type="search"
            ref={searchRef}
            size={1}
            placeholder={
              isCloud ?
                isOnMacOS() ?
                  getText('remoteBackendSearchPlaceholderMacOs')
                : getText('remoteBackendSearchPlaceholder')
              : getText('localBackendSearchPlaceholder')
            }
            className="focus-child peer text relative z-1 w-full bg-transparent placeholder-primary/40"
            onChange={searchFieldOnChange}
            onKeyDown={searchInputOnKeyDown}
          />
        </SearchField>
      </FocusRing>
    </>
  )
})

/**
 * Props for a {@link AssetSearchBarPopover}.
 */
interface AssetSearchBarPopoverProps {
  readonly areSuggestionsVisible: boolean
  readonly isCloud: boolean
  readonly querySource: MutableRefObject<QuerySource>
  readonly query: AssetQuery
  readonly setQuery: Dispatch<SetStateAction<AssetQuery>>
  readonly suggestions: readonly Suggestion[]
  readonly selectedIndex: number | null
  readonly setAreSuggestionsVisible: (value: boolean) => void
  readonly baseQuery: MutableRefObject<AssetQuery>
  readonly backend: Backend | null
}

/**
 * Renders the popover containing suggestions.
 */
const AssetSearchBarPopover = memo(function AssetSearchBarPopover(
  props: AssetSearchBarPopoverProps,
) {
  const {
    areSuggestionsVisible,
    isCloud,
    querySource,
    query,
    setQuery,
    suggestions,
    selectedIndex,
    setAreSuggestionsVisible,
    baseQuery,
    backend,
  } = props

  const [selectedIndices, setSelectedIndices] = useState<ReadonlySet<number>>(new Set<number>())

  return (
    <>
      <AnimatePresence mode="wait" custom={suggestions.length}>
        {areSuggestionsVisible && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={DIALOG_BACKGROUND({
              className:
                'absolute left-0 right-0 top-0 z-1 grid w-full overflow-hidden rounded-default border-0.5 border-primary/20 -outline-offset-1 outline-primary',
            })}
          >
            <div className="overflow-hidden">
              <div className="relative mt-3 flex flex-col gap-3 pt-8">
                {/* Tags (`name:`, `modified:`, etc.) */}
                <Tags
                  isCloud={isCloud}
                  querySource={querySource}
                  query={query}
                  setQuery={setQuery}
                />
                {/* Asset labels */}
                <Labels
                  isCloud={isCloud}
                  query={query}
                  setQuery={setQuery}
                  querySource={querySource}
                  baseQuery={baseQuery}
                  backend={backend}
                />
                {/* Suggestions */}
                <div className="flex max-h-search-suggestions-list flex-col overflow-y-auto overflow-x-hidden pb-0.5 pl-0.5">
                  {suggestions.map((suggestion, index) => (
                    <SuggestionRenderer
                      key={suggestion.key}
                      index={index}
                      selectedIndex={selectedIndex}
                      selectedIndices={selectedIndices}
                      querySource={querySource}
                      setQuery={setQuery}
                      suggestion={suggestion}
                      setSelectedIndices={setSelectedIndices}
                      setAreSuggestionsVisible={setAreSuggestionsVisible}
                      query={query}
                      baseQuery={baseQuery}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
})

/**
 * Props for a {@link SuggestionRenderer}.
 */
interface SuggestionRendererProps {
  readonly index: number
  readonly suggestion: Suggestion
  readonly query: AssetQuery
  readonly baseQuery: MutableRefObject<AssetQuery>
  readonly selectedIndex: number | null
  readonly selectedIndices: ReadonlySet<number>
  readonly setSelectedIndices: Dispatch<SetStateAction<ReadonlySet<number>>>
  readonly querySource: MutableRefObject<QuerySource>
  readonly setQuery: Dispatch<SetStateAction<AssetQuery>>
  readonly setAreSuggestionsVisible: (value: boolean) => void
}

/**
 * Renders a suggestion.
 */
const SuggestionRenderer = memo(function SuggestionRenderer(props: SuggestionRendererProps) {
  const {
    index,
    selectedIndex,
    selectedIndices,
    querySource,
    setQuery,
    suggestion,
    setSelectedIndices,
    setAreSuggestionsVisible,
    query,
    baseQuery,
  } = props

  return (
    <AriaButton
      data-testid="asset-search-suggestion"
      key={index}
      ref={(el) => {
        if (index === selectedIndex) {
          el?.focus()
        }
      }}
      className={twMerge(
        'flex w-full cursor-pointer rounded-l-default rounded-r-sm px-[7px] py-0.5 text-left transition-[background-color] hover:bg-primary/5',
        selectedIndices.has(index) && 'bg-primary/10',
        index === selectedIndex && 'bg-selected-frame',
      )}
      onPress={(event) => {
        unsafeWriteValue(querySource, 'current', QuerySource.internal)
        setQuery(
          selectedIndices.has(index) ?
            suggestion.deleteFromQuery(event.shiftKey ? query : baseQuery.current)
          : suggestion.addToQuery(event.shiftKey ? query : baseQuery.current),
        )
        if (event.shiftKey) {
          setSelectedIndices(
            new Set(
              selectedIndices.has(index) ?
                [...selectedIndices].filter((otherIndex) => otherIndex !== index)
              : [...selectedIndices, index],
            ),
          )
        } else {
          setAreSuggestionsVisible(false)
        }
      }}
    >
      <Text variant="body" truncate="1" className="w-full">
        {suggestion.render()}
      </Text>
    </AriaButton>
  )
})

/**
 * Props for a {@link Labels}.
 */
interface LabelsProps {
  readonly isCloud: boolean
  readonly query: AssetQuery
  readonly setQuery: Dispatch<SetStateAction<AssetQuery>>
  readonly backend: Backend | null
  readonly querySource: MutableRefObject<QuerySource>
  readonly baseQuery: MutableRefObject<AssetQuery>
}

/**
 * Renders labels.
 */
const Labels = memo(function Labels(props: LabelsProps) {
  const { isCloud, query, setQuery, backend, querySource, baseQuery } = props

  const labels = useBackendQuery(backend, 'listTags', []).data ?? []

  const labelOnPress = useEventCallback(
    (event: PressEvent | ReactMouseEvent<HTMLButtonElement>, label?: BackendLabel) => {
      if (label == null) {
        return
      }
      unsafeWriteValue(querySource, 'current', QuerySource.internal)
      setQuery((oldQuery) => {
        const newQuery = oldQuery.withToggled(
          'labels',
          'negativeLabels',
          label.value,
          event.shiftKey,
        )
        unsafeWriteValue(baseQuery, 'current', newQuery)
        return newQuery
      })
    },
  )

  return (
    <>
      {isCloud && labels.length !== 0 && (
        <div data-testid="asset-search-labels" className="pointer-events-auto flex gap-2 px-1.5">
          {[...labels]
            .sort((a, b) => compareCaseInsensitive(a.value, b.value))
            .map((label) => {
              const negated = query.negativeLabels.some((term) => shallowEqual(term, [label.value]))
              return (
                <Label
                  key={label.id}
                  color={label.color}
                  label={label}
                  active={negated || query.labels.some((term) => shallowEqual(term, [label.value]))}
                  negated={negated}
                  onPress={labelOnPress}
                >
                  {label.value}
                </Label>
              )
            })}
        </div>
      )}
    </>
  )
})

export default memo(AssetSearchBar)
