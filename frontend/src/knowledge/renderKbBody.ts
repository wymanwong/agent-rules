import { marked } from 'marked';
import { sanitizeKbHtml } from './kbHtmlSanitize';

marked.setOptions({
  gfm: true,
  breaks: true,
});

/** Sanitized HTML for knowledge article body (html, markdown, or plain text). */
export function renderKbBody(body: string, bodyFormat: string | undefined): string {
  const rawFmt = (bodyFormat ?? '').trim();
  const fmt =
    rawFmt === 'plain' ? 'plain' : rawFmt === 'markdown' ? 'markdown' : rawFmt === 'html' ? 'html' : 'markdown';
  if (fmt === 'plain') {
    const escaped = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br />');
    return sanitizeKbHtml(`<div class="kb-plain">${escaped}</div>`);
  }
  if (fmt === 'markdown') {
    const raw = marked.parse(body || '', { async: false }) as string;
    return sanitizeKbHtml(raw);
  }
  return sanitizeKbHtml(body || '');
}
