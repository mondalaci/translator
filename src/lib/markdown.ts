import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.setOptions({ gfm: true, breaks: true })

/** Model output is Markdown; sanitise it before it reaches the DOM. */
export function renderMarkdown(source: string): string {
  const html = marked.parse(source, { async: false }) as string
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}

/** Strip Markdown syntax, used for history previews and speech. */
export function plainText(source: string): string {
  return source
    .replace(/[*_`>#]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}
