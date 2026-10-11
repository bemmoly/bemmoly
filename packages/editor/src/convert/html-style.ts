import { themeById } from '@bemmoly/ui/tokens';

/*
 * The stylesheet an HTML export carries inline, so the file reads the same opened from a
 * disk, mailed or printed. Values come from the Classic theme's tokens (an export is read
 * outside the app, where the workspace theme does not follow), and the measures are the
 * Doc Editor mock's: a 720px column, 15.5px body at 1.7, 22px section headings.
 */

export function exportStylesheet(): string {
  const theme = themeById('light');
  const c = theme.colors;
  return [
    `body{margin:0;background:${c.card};color:${c.tx};font:15.5px/1.7 ${theme.fontUi}}`,
    `article{max-width:720px;margin:0 auto;padding:48px 40px 96px;display:flex;flex-direction:column;gap:18px}`,
    `article>*{margin:0}`,
    `h1{font-size:36px;line-height:1.15;letter-spacing:-.02em;font-weight:600;color:${c.tx}}`,
    `h2{font-size:22px;letter-spacing:-.01em;font-weight:600;color:${c.tx};margin-top:10px}`,
    `h3{font-size:18px;font-weight:600;color:${c.tx}}`,
    `p,ul,ol,blockquote,pre,figure,table{margin:0}`,
    `ul,ol{padding-left:22px;display:flex;flex-direction:column;gap:6px}`,
    `ul.tasks{list-style:none;padding-left:0}`,
    `a{color:${c.acc};text-decoration:none}`,
    `code{font:500 13.5px ${theme.fontCode};background:${c['line-2']};padding:1px 5px;border-radius:3px}`,
    `pre{background:${c['line-2']};border-radius:5px;padding:10px 14px;overflow:auto}`,
    `pre code{background:none;padding:0;font-weight:400}`,
    `blockquote{border-left:3px solid ${c.line};padding-left:12px;color:${c['tx-2']}}`,
    `hr{border:0;border-top:1px solid ${c['line-2']};width:100%}`,
    `table{border-collapse:collapse;width:100%;font-size:13.5px}`,
    `th,td{border:1px solid ${c.line};padding:6px 10px;text-align:left;vertical-align:top}`,
    `th{background:${c.side};font-weight:600;color:${c.tx}}`,
    `th>*,td>*{margin:0}`,
    `img{max-width:100%;border-radius:8px;border:1px solid ${c.line}}`,
    `.callout{border:1px solid ${c['acc-100']};background:${c['acc-50']};border-radius:8px;padding:12px 16px;font-size:13.5px;line-height:1.55}`,
    `.callout-note{border-color:${c.line};background:${c.side}}`,
    `.callout-success{border-color:${c['green-50']};background:${c['green-50']}}`,
    `.callout-warning{border-color:${c['amber-bg']};background:${c['amber-bg']}}`,
    `.callout-danger{border-color:${c['amber-50']};background:${c['amber-50']}}`,
    `.decision{border:1px solid ${c.line};border-left:3px solid ${c.green};border-radius:8px;padding:12px 16px}`,
    `.decision-label{font-size:12.5px;font-weight:600;color:${c['green-tx']};margin:0 0 4px}`,
    `.mention,.page-link{color:${c.acc};font-weight:500}`,
    `.issue{font:500 12px ${theme.fontCode};border:1px solid ${c.line};border-radius:4px;padding:1px 7px}`,
    `.issue-table,.unsupported{border:1px dashed ${c.line};border-radius:8px;padding:12px 16px;color:${c['tx-3']};font-size:13.5px}`,
    `nav.toc{font-size:13.5px}nav.toc ul{list-style:none;padding-left:0;gap:2px}`,
    `.toc-2{margin-left:16px}.toc-3{margin-left:32px}`,
    // Print, and Save as PDF through the browser's print dialog: plain paper, no split blocks.
    `@page{margin:18mm 16mm}`,
    `@media print{body{background:#fff}article{padding:0;max-width:none}a{color:inherit}`,
    `h1,h2,h3{break-after:avoid}pre,table,figure,blockquote,.callout,.decision,img{break-inside:avoid}}`,
  ].join('\n');
}
