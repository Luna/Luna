export async function htmlToMarkdown(html: string): Promise<string> {
  const { htmlToMarkdownImpl } = await import(
    '@/components/MarkdownEditor/htmlToMarkdown/htmlToMarkdownImpl'
  )
  return htmlToMarkdownImpl(html)
}
