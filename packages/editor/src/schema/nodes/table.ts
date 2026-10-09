import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import type { RichTextNode } from '../../types.ts';
import type { DocNode, ExportContext } from './types.ts';

/*
 * A table with an optional header row. Cells hold blocks, as Tiptap's table does, so a cell
 * can carry a list; exports flatten a cell to its inline text where the format has no room
 * for blocks (Markdown). Column widths are not stored: the page's measure decides them.
 */

const rowsOf = (node: RichTextNode) => node.content ?? [];
const cellsOf = (row: RichTextNode) => row.content ?? [];

/**
 * A cell's paragraphs as one line, for formats whose cells hold only inline content. The
 * Markdown printer already escapes a pipe in text, so the row stays one row.
 */
function cellLine(cell: RichTextNode, context: ExportContext): string {
  return (cell.content ?? [])
    .map((block) => context.inline(block.content))
    .filter(Boolean)
    .join(' ');
}

function tableMarkdown(node: RichTextNode, context: ExportContext): string {
  const rows = rowsOf(node);
  if (rows.length === 0) return '';
  const width = Math.max(...rows.map((row) => cellsOf(row).length), 1);
  const line = (row: RichTextNode) => {
    const cells = cellsOf(row).map((cell) => cellLine(cell, context));
    while (cells.length < width) cells.push('');
    return `| ${cells.join(' | ')} |`;
  };
  const first = rows[0]!;
  const headed = cellsOf(first).every((cell) => cell.type === 'tableHeader');
  const header = headed ? line(first) : `| ${Array<string>(width).fill(' ').join(' | ')} |`;
  const body = (headed ? rows.slice(1) : rows).map(line);
  return [header, `| ${Array<string>(width).fill('---').join(' | ')} |`, ...body].join('\n');
}

function tableHtml(node: RichTextNode, context: ExportContext): string {
  const rows = rowsOf(node)
    .map((row) => {
      const cells = cellsOf(row)
        .map((cell) => {
          const tag = cell.type === 'tableHeader' ? 'th' : 'td';
          const colspan = Number(cell.attrs?.['colspan'] ?? 1);
          const rowspan = Number(cell.attrs?.['rowspan'] ?? 1);
          const span =
            (colspan > 1 ? ` colspan="${colspan}"` : '') +
            (rowspan > 1 ? ` rowspan="${rowspan}"` : '');
          return `<${tag}${span}>${context.blocks(cell.content)}</${tag}>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<table><tbody>${rows}</tbody></table>`;
}

export const table: DocNode = {
  name: 'table',
  extensions: () => [
    Table.configure({ resizable: false, renderWrapper: false }),
    TableRow,
    TableHeader,
    TableCell,
  ],
  toMarkdown: tableMarkdown,
  toHtml: tableHtml,
};
