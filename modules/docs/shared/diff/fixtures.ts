import type { DiffMark, DiffNode } from './types.ts';

/** Small builders for ProseMirror JSON, so each diff fixture reads like the page it is. */

export const text = (value: string, marks?: DiffMark[]): DiffNode => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {}),
});

export const bold: DiffMark = { type: 'bold' };
export const link = (href: string): DiffMark => ({ type: 'link', attrs: { href } });

export const p = (...content: (string | DiffNode)[]): DiffNode => ({
  type: 'paragraph',
  ...(content.length
    ? { content: content.map((part) => (typeof part === 'string' ? text(part) : part)) }
    : {}),
});

export const h = (level: number, value: string): DiffNode => ({
  type: 'heading',
  attrs: { level },
  content: [text(value)],
});

export const mention = (id: string, label: string): DiffNode => ({
  type: 'mention',
  attrs: { id, label },
});

export const cell = (value: string, header = false): DiffNode => ({
  type: header ? 'tableHeader' : 'tableCell',
  attrs: { colspan: 1, rowspan: 1, colwidth: null },
  content: [p(value)],
});

export const row = (...cells: DiffNode[]): DiffNode => ({ type: 'tableRow', content: cells });
export const table = (...rows: DiffNode[]): DiffNode => ({ type: 'table', content: rows });

export const bullets = (...items: string[]): DiffNode => ({
  type: 'bulletList',
  content: items.map((item) => ({ type: 'listItem', content: [p(item)] })),
});

export const doc = (...blocks: DiffNode[]): DiffNode => ({ type: 'doc', content: blocks });

/** Five paragraphs that read nothing alike, for reorder fixtures. */
export const PROSE = [
  'Ship the importer behind a flag until the mapping review lands.',
  'Kafka stays the transport for audit events this quarter.',
  'Owners review their runbooks every ninety days.',
  'The migration window is Saturday morning UTC.',
  'Rollback means restoring the previous snapshot from object storage.',
] as const;
