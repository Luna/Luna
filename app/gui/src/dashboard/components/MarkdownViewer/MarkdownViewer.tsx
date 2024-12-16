/** @file A Markdown viewer component. */

import { useText } from '#/providers/TextProvider'
import { useSuspenseQuery } from '@tanstack/react-query'
import type { RendererObject } from 'marked'
import { marked } from 'marked'
import { type TestIdProps } from '../AriaComponents'
import { defaultRenderer } from './defaultRenderer'

/** Props for a {@link MarkdownViewer}. */
export interface MarkdownViewerProps extends TestIdProps {
  /** Markdown markup to parse and display. */
  readonly text: string
  readonly imgUrlResolver: (relativePath: string) => Promise<string>
  readonly renderer?: RendererObject
}

/**
 * Markdown viewer component.
 * Parses markdown passed in as a `text` prop into HTML and displays it.
 */
export function MarkdownViewer(props: MarkdownViewerProps) {
  const { text, imgUrlResolver, renderer = defaultRenderer, testId } = props

  const { getText } = useText()

  const markedInstance = marked.use({ renderer: Object.assign({}, defaultRenderer, renderer) })

  const { data: markdownToHtml } = useSuspenseQuery({
    queryKey: ['markdownToHtml', { text, imgUrlResolver, markedInstance }] as const,
    queryFn: ({ queryKey: [, args] }) =>
      args.markedInstance.parse(args.text, {
        async: true,
        walkTokens: async (token) => {
          if (token.type === 'image' && 'href' in token && typeof token.href === 'string') {
            const href = token.href

            token.raw = href
            token.href = await args.imgUrlResolver(href).catch(() => null)
            token.text = getText('arbitraryFetchImageError')
          }
        },
      }),
  })

  return (
    <div
      className="select-text"
      data-testid={testId}
      // eslint-disable-next-line @typescript-eslint/naming-convention
      dangerouslySetInnerHTML={{ __html: markdownToHtml }}
    />
  )
}
