import DOMPurify from 'dompurify';

/** Sanitize article HTML for display or round-trip in the editor (Word paste–safe subset). */
export function sanitizeKbHtml(html: string): string {
  return DOMPurify.sanitize(html || '', {
    ALLOWED_TAGS: [
      'p', 'br', 'div', 'span',
      'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sub', 'sup',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote',
      'code', 'pre',
      'a',
      'img',
      'hr',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col',
      'figure', 'figcaption',
    ],
    // Omit `class` so pasted Word styles (e.g. MsoNormal) do not leak into the reader.
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'src', 'alt', 'colspan', 'rowspan', 'align', 'width'],
    ALLOW_DATA_ATTR: false,
  });
}
