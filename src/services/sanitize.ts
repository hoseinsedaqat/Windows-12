import DOMPurify from 'dompurify';

/**
 * Every piece of rich text in the simulator (Word documents, note bodies,
 * browser "pages") passes through here before it is rendered as HTML.
 * Scripts, event handlers and foreign objects are stripped.
 */
type SanitizeConfig = Parameters<typeof DOMPurify.sanitize>[1];

const CONFIG: SanitizeConfig = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['target', 'rel', 'dir', 'align', 'colspan', 'rowspan', 'width', 'height', 'style'],
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'meta', 'link', 'base'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'srcdoc'],
  ALLOW_DATA_ATTR: false,
};

export function sanitizeHtml(dirty: string): string {
  if (typeof dirty !== 'string') return '';
  try {
    return DOMPurify.sanitize(dirty, CONFIG) as unknown as string;
  } catch {
    return escapeHtml(dirty);
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BLOCK_SELECTOR = 'p, div, section, article, blockquote, li, tr, h1, h2, h3, h4, h5, h6, pre, table, ul, ol';
const BLOCK_END_RE = /<\/(?:p|div|section|article|blockquote|li|tr|h[1-6]|pre|table|ul|ol)>/gi;

/**
 * Plain-text extraction from rich HTML (used for search, word counts, TXT export).
 * Block elements become line breaks — otherwise "Sales grew" and the next
 * paragraph would be glued into a single word.
 */
export function htmlToText(html: string): string {
  if (typeof html !== 'string') return '';
  if (typeof document === 'undefined') {
    return html
      .replace(/<br\s*\/?><\/?>/gi, '\n')
      .replace(BLOCK_END_RE, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]*\n[ \t]*/g, '\n')
      .trim();
  }
  const container = document.createElement('div');
  container.innerHTML = sanitizeHtml(html);
  container.querySelectorAll('br').forEach((br) => br.replaceWith(document.createTextNode('\n')));
  container.querySelectorAll(BLOCK_SELECTOR).forEach((element) => {
    element.appendChild(document.createTextNode('\n'));
  });
  return (container.textContent ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function countWords(html: string): number {
  const text = htmlToText(html);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}
