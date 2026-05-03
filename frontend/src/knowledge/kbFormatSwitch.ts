import TurndownService from 'turndown';
import { marked } from 'marked';
import { bodyToEditorHtml } from './bodyToEditorHtml';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
});

marked.setOptions({ gfm: true, breaks: true });

function htmlToPlainText(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, ' ').trim();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').replace(/\s+\n/g, '\n').trim();
}

/** Convert current body string when user changes body_format in the editor UI. */
export function convertBodyForFormatChange(
  currentBody: string,
  from: 'html' | 'markdown' | 'plain',
  to: 'html' | 'markdown' | 'plain',
): string {
  if (from === to) return currentBody;
  if (to === 'html') {
    return bodyToEditorHtml(currentBody, from === 'plain' ? 'plain' : 'markdown');
  }
  if (to === 'markdown') {
    if (from === 'html') return turndown.turndown(currentBody || '<p></p>');
    if (from === 'plain') return currentBody;
    return currentBody;
  }
  // to === 'plain'
  if (from === 'html') return htmlToPlainText(currentBody);
  if (from === 'markdown') {
    const html = marked.parse(currentBody || '', { async: false }) as string;
    return htmlToPlainText(html);
  }
  return currentBody;
}
