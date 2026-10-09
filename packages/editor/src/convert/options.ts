/** Where links in an export point. Both are optional: without them a link prints its text. */
export interface ExportOptions {
  /** A page's URL by id, absolute for a file that leaves the app. */
  pageHref?: (pageId: string) => string | null;
  /** An issue's URL by key. */
  issueHref?: (key: string) => string | null;
}

/** Links an export follows: the web, mail and paths inside the app. */
export const SAFE_LINK = /^(https?:|mailto:|\/(?!\/)|#)/i;

/** A host-supplied URL, kept only when it is one an export may follow. */
export const safeHref = (href: string | null | undefined): string | null =>
  href && SAFE_LINK.test(href) ? href : null;

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]!);

/** Characters Markdown would read as syntax inside running text. */
export const escapeMarkdown = (text: string) => text.replace(/([\\`*_[\]<>~|])/g, '\\$1');

/** A line that would start a heading, quote, list or rule is escaped at its start. */
export const escapeLineStart = (line: string) =>
  line
    .replace(/^(\s*)(#{1,6}\s|>|[-+]\s|-{3,}\s*$|={3,}\s*$)/, '$1\\$2')
    .replace(/^(\s*\d+)([.)]\s)/, '$1\\$2');
