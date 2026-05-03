import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  gfm: true,
  breaks: true,
});

const KB_PURIFY: Parameters<typeof DOMPurify.sanitize>[1] = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img', 'hr', 'table',
    'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div',
  ],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'src', 'alt', 'class'],
  ALLOW_DATA_ATTR: false,
};

/** Sanitized HTML for knowledge article body (Markdown or plain text). */
export function renderKbBody(body: string, bodyFormat: string | undefined): string {
  const fmt = bodyFormat === 'plain' ? 'plain' : 'markdown';
  if (fmt === 'plain') {
    const escaped = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br />');
    return DOMPurify.sanitize(`<div class="kb-plain">${escaped}</div>`, KB_PURIFY);
  }
  const raw = marked.parse(body || '', { async: false }) as string;
  return DOMPurify.sanitize(raw, KB_PURIFY);
}
