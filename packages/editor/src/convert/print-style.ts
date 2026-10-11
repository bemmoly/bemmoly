import {
  FONTS,
  MONO_STACK,
  PRINT_LEADING,
  PRINT_MARGINS,
  PRINT_PAPERS,
  PRINT_SPACE,
  PRINT_TYPE,
  resolveTheme,
  type PrintPaper,
} from '@bemmoly/ui/tokens';

/*
 * The stylesheet a printed page carries: the print tokens (points and millimetres) over the
 * Classic light theme's colours, since paper never follows a preset or dark mode. Blocks do
 * not split across pages, headings stay with what follows, and each page of a subtree starts
 * on a new sheet. Code colours are the editor's, read from the same theme pairs.
 */

export function printStylesheet(paper: PrintPaper): string {
  const c = resolveTheme('bemmoly', 'light').colors;
  const size = PRINT_PAPERS[paper];
  const t = PRINT_TYPE;
  return [
    `@page{size:${size.width} ${size.height};margin:${PRINT_MARGINS.top} ${PRINT_MARGINS.side} ${PRINT_MARGINS.bottom}}`,
    `html{-webkit-print-color-adjust:exact;print-color-adjust:exact}`,
    `body{margin:0;background:#fff;color:${c.tx};font:${t.body}/${PRINT_LEADING.body} ${FONTS.plex.stack}}`,
    `article{display:flex;flex-direction:column;gap:${PRINT_SPACE.block}}`,
    `article>*,section.page>*{margin:0}`,
    `section.page{display:flex;flex-direction:column;gap:${PRINT_SPACE.block}}`,
    `section.page+section.page{break-before:page}`,
    `h1,h2,h3,h4{line-height:${PRINT_LEADING.heading};font-weight:600;color:${c.tx};break-after:avoid}`,
    `h1{font-size:${t.h1};letter-spacing:-.01em;margin-bottom:${PRINT_SPACE.block}}`,
    `h2{font-size:${t.h2};margin-top:${PRINT_SPACE.section}}`,
    `h3,h4{font-size:${t.h3};margin-top:${PRINT_SPACE.block}}`,
    `p,ul,ol,blockquote,pre,figure,table{margin:0;orphans:3;widows:3}`,
    `ul,ol{padding-left:16pt;display:flex;flex-direction:column;gap:3pt}`,
    `ul.tasks{list-style:none;padding-left:0}`,
    `a{color:${c.acc};text-decoration:none}`,
    `code{font:500 ${t.small} ${MONO_STACK};background:${c['line-2']};padding:0 3pt;border-radius:2pt}`,
    `pre{background:${c.sunken};border:.5pt solid ${c.line};border-radius:4pt;padding:6pt 9pt;white-space:pre-wrap;word-break:break-word}`,
    `pre code{background:none;padding:0;font-weight:400;line-height:1.45}`,
    `blockquote{border-left:2pt solid ${c.line};padding-left:9pt;color:${c['tx-2']}}`,
    `hr{border:0;border-top:.5pt solid ${c.line};width:100%}`,
    `table{border-collapse:collapse;width:100%;font-size:${t.small}}`,
    `th,td{border:.5pt solid ${c.line};padding:4pt 6pt;text-align:left;vertical-align:top}`,
    `th{background:${c.side};font-weight:600}`,
    `thead{display:table-header-group}tr{break-inside:avoid}`,
    `th>*,td>*{margin:0}`,
    `figure{text-align:center}img{max-width:100%;max-height:200mm;border:.5pt solid ${c.line};border-radius:4pt}`,
    `.callout{border:.5pt solid ${c['acc-100']};background:${c['acc-50']};border-radius:4pt;padding:7pt 10pt;font-size:${t.small}}`,
    `.callout-note{border-color:${c.line};background:${c.side}}`,
    `.callout-success{border-color:${c['green-50']};background:${c['green-50']}}`,
    `.callout-warning{border-color:${c['amber-bg']};background:${c['amber-bg']}}`,
    `.callout-danger{border-color:${c['amber-50']};background:${c['amber-50']}}`,
    `.decision{border:.5pt solid ${c.line};border-left:2pt solid ${c.green};border-radius:4pt;padding:7pt 10pt}`,
    `.decision-label{font-size:${t.small};font-weight:600;color:${c['green-tx']}}`,
    `.mention,.page-link{color:${c.acc};font-weight:500}`,
    `.issue,.issue-card{font:500 ${t.small} ${MONO_STACK};color:${c.tx}}`,
    `.issue{border:.5pt solid ${c.line};border-radius:3pt;padding:0 4pt;white-space:nowrap}`,
    `.issue-card{border:.5pt solid ${c.line};border-radius:4pt;padding:5pt 8pt}`,
    `.issue-card a{color:${c.tx}}`,
    `.issue-title{font-family:${FONTS.plex.stack};font-weight:400}`,
    `.issue-status{font-family:${FONTS.plex.stack};color:${c['tx-3']}}`,
    `.issue-table,.unsupported{border:.5pt dashed ${c.line};border-radius:4pt;padding:7pt 10pt;color:${c['tx-3']};font-size:${t.small}}`,
    `nav.toc{font-size:${t.small}}nav.toc ul{list-style:none;padding-left:0;gap:2pt}`,
    `.toc-2{margin-left:10pt}.toc-3{margin-left:20pt}`,
    `nav.contents{break-after:page}nav.contents h1{font-size:${t.h2}}`,
    `nav.contents ol{list-style:none;padding-left:0;gap:4pt}nav.contents a{color:${c.tx}}`,
    `.depth-1{margin-left:12pt}.depth-2{margin-left:24pt}.depth-3{margin-left:36pt}`,
    `.image-alt{color:${c['tx-3']};font-style:italic;font-size:${t.small}}`,
    `pre,table,figure,blockquote,.callout,.decision,.issue-card,img{break-inside:avoid}`,
    `.hljs-comment,.hljs-quote{color:${c['tx-3']};font-style:italic}`,
    `.hljs-keyword,.hljs-selector-tag,.hljs-literal{color:${c.acc}}`,
    `.hljs-string,.hljs-regexp,.hljs-addition{color:${c['green-tx']}}`,
    `.hljs-number,.hljs-deletion{color:${c['amber-tx']}}`,
    `.hljs-title,.hljs-section{color:${c['violet-fg']}}`,
    `.hljs-type,.hljs-built_in{color:${c['sky-fg']}}`,
    `.hljs-attr,.hljs-attribute,.hljs-variable{color:${c['amber-fg']}}`,
    `.hljs-meta,.hljs-symbol{color:${c['pink-fg']}}`,
  ].join('\n');
}

/** Chromium's running header: the document's title. Its own styles, as the header has none. */
export function printHeaderTemplate(title: string, escape: (text: string) => string): string {
  const c = resolveTheme('bemmoly', 'light').colors;
  return `<html><body style="margin:0;width:100%;font:${PRINT_TYPE.meta} ${FONTS.plex.stack};color:${c['tx-3']};padding:0 ${PRINT_MARGINS.side}"><div style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${escape(title)}</div></body></html>`;
}

/** Chromium's running footer: "3 / 12", the classes Chromium fills in. */
export function printFooterTemplate(): string {
  const c = resolveTheme('bemmoly', 'light').colors;
  return `<html><body style="margin:0;width:100%;font:${PRINT_TYPE.meta} ${FONTS.plex.stack};color:${c['tx-3']};padding:0 ${PRINT_MARGINS.side};text-align:right"><span class="pageNumber"></span> / <span class="totalPages"></span></body></html>`;
}
