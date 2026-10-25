import type { LinkPreview } from '@bemmoly/core';

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);

/**
 * The shell's index.html naming one record: its <title> and description, plus the Open Graph
 * and Twitter tags chat apps read when someone shares the link. Titles are people's text, so
 * every value is escaped.
 */
export function withLinkPreview(html: string, preview: LinkPreview): string {
  const title = escapeHtml(preview.title);
  const description = escapeHtml(preview.description);
  const tags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(preview.siteName)}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
  ].join('\n    ');
  return html
    .replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>`)
    .replace(
      /<meta name="description" content="[^"]*"\s*\/?>/,
      () => `<meta name="description" content="${description}" />`,
    )
    .replace('</head>', () => `  ${tags}\n  </head>`);
}
