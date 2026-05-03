import { marked } from 'marked';
import { sanitizeKbHtml } from './kbHtmlSanitize';

marked.setOptions({ gfm: true, breaks: true });

function escapePlain(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Turn stored article body into HTML for the TipTap editor (legacy markdown/plain supported). */
export function bodyToEditorHtml(body: string, bodyFormat: string | undefined): string {
  const rawFmt = (bodyFormat ?? '').trim();
  const fmt =
    rawFmt === 'plain' ? 'plain' : rawFmt === 'markdown' ? 'markdown' : rawFmt === 'html' ? 'html' : 'markdown';
  if (fmt === 'plain') {
    const inner = escapePlain(body || '').replace(/\n/g, '<br />');
    return sanitizeKbHtml(`<p>${inner}</p>`);
  }
  if (fmt === 'markdown') {
    const raw = marked.parse(body || '', { async: false }) as string;
    return sanitizeKbHtml(raw);
  }
  return sanitizeKbHtml(body || '<p></p>');
}
