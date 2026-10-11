import type { PrintPaper } from '@bemmoly/ui/tokens';
import type { RichTextDoc } from '../types.ts';
import { highlightCode } from './highlight-code.ts';
import { escapeHtml, type ExportOptions } from './options.ts';
import { printFooterTemplate, printHeaderTemplate, printStylesheet } from './print-style.ts';
import { toHtml } from './to-html.ts';

/*
 * One printable document for a page or a page and everything under it: a PDF from the
 * renderer, or the browser's print view. A subtree opens with its contents, each page starts
 * on a new sheet, and links between the pages in it jump inside the document. Like the HTML
 * export, every byte is written from the document JSON and escaped, and nothing is fetched:
 * the host passes images it wants printed as data: URIs through `imageSrc`.
 */

export interface PrintPage {
  id: string;
  title: string;
  doc: RichTextDoc | null | undefined;
  /** 0 for the page the export starts at, 1 for its children, and so on. */
  depth: number;
}

export interface PrintOptions extends Omit<ExportOptions, 'highlight'> {
  paper: PrintPaper;
}

export interface PrintDocument {
  html: string;
  /** Chromium's running header and footer: the title, and "page / pages". */
  headerHtml: string;
  footerHtml: string;
}

const anchorOf = (pageId: string) => `page-${pageId.replace(/[^a-zA-Z0-9-]/g, '')}`;

/** The contents of a subtree: every page, indented by its depth, linking to its section. */
function contents(pages: readonly PrintPage[]): string {
  const rows = pages
    .map(
      (page) =>
        `<li class="depth-${Math.min(page.depth, 3)}"><a href="#${anchorOf(page.id)}">${escapeHtml(page.title || 'Untitled')}</a></li>`,
    )
    .join('');
  return `<nav class="contents"><h1>Contents</h1><ol>${rows}</ol></nav>`;
}

export function toPrintDocument(
  title: string,
  pages: readonly PrintPage[],
  options: PrintOptions,
): PrintDocument {
  const inside = new Set(pages.map((page) => page.id));
  const body: ExportOptions = {
    ...options,
    highlight: highlightCode,
    pageHref: (pageId) =>
      inside.has(pageId) ? `#${anchorOf(pageId)}` : (options.pageHref?.(pageId) ?? null),
  };
  const sections = pages
    .map(
      (page) =>
        `<section class="page" id="${anchorOf(page.id)}"><h1>${escapeHtml(page.title || 'Untitled')}</h1>${toHtml(page.doc, body)}</section>`,
    )
    .join('');
  const safeTitle = escapeHtml(title || 'Untitled');
  const html = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${safeTitle}</title>`,
    `<style>${printStylesheet(options.paper)}</style>`,
    '</head>',
    `<body><article>${pages.length > 1 ? contents(pages) : ''}${sections}</article></body>`,
    '</html>',
    '',
  ].join('\n');
  return {
    html,
    headerHtml: printHeaderTemplate(title || 'Untitled', escapeHtml),
    footerHtml: printFooterTemplate(),
  };
}
