/** Where links in an export point. Both are optional: without them a link prints its text. */
export interface ExportOptions {
  /** A page's URL by id, absolute for a file that leaves the app. */
  pageHref?: (pageId: string) => string | null;
  /** An issue's URL by key. */
  issueHref?: (key: string) => string | null;
  /**
   * Where an image's source points in the export: a file beside it, a data: URI that embeds
   * it, null to keep the source as stored, or false to print its alt text instead.
   */
  imageSrc?: (src: string) => string | null | false;
  /** Code as highlighted, escaped markup; without it code prints plain. */
  highlight?: (code: string, language: string | null) => string | null;
  /** An issue's title and status for a static chip; without it the chip shows the key. */
  issueSummary?: (key: string) => { title: string; status?: string } | null;
}

/** Links an export follows: the web, mail and paths inside the app. */
export const SAFE_LINK = /^(https?:|mailto:|\/(?!\/)|#)/i;

/**
 * What a host may also point an export's links at: a file next to this one ("./a.md",
 * "../b.html"), so a folder of exported pages links between its files offline.
 */
const RELATIVE_FILE = /^\.\.?\/(?!\/)/;

/** A host-supplied URL, kept only when it is one an export may follow. */
export const safeHref = (href: string | null | undefined): string | null =>
  href && (SAFE_LINK.test(href) || RELATIVE_FILE.test(href)) ? href : null;

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

/** An image's source in an export: the host's choice when it has one, else as stored. */
export const imageSource = (src: string, options: ExportOptions): string => {
  const chosen = options.imageSrc?.(src);
  if (chosen === false) return '';
  return chosen && (/^data:image\/(png|jpeg|gif|webp);base64,/.test(chosen) || safeHref(chosen))
    ? chosen
    : src;
};
