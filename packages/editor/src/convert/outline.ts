import type { RichTextDoc } from '../types.ts';
import { textOf } from './walk.ts';

/*
 * A page's outline: its headings and the anchor each carries. Kept free of the schema so the
 * read-only view can print a table of contents without loading ProseMirror.
 */

export interface TocEntry {
  level: number;
  text: string;
  /** The anchor the heading carries in the view and in exports. */
  id: string;
}

/** "Migration order" as "migration-order"; empty headings become "section". */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

/**
 * The page's headings down to `maxLevel`, top level only (not inside callouts or tables), each
 * with an anchor that is unique on the page: a repeated heading gets "-2", "-3".
 */
export function buildToc(doc: RichTextDoc | null | undefined, maxLevel = 3): TocEntry[] {
  const ids = headingIds(doc);
  return (doc?.content ?? [])
    .filter((node) => node.type === 'heading')
    .flatMap((node, index) => {
      const level = Number(node.attrs?.['level'] ?? 1);
      const text = textOf(node).trim();
      return level <= maxLevel && text ? [{ level, text, id: ids[index]! }] : [];
    });
}

/** The anchor of every top-level heading, in order; what the view and exports print. */
export function headingIds(doc: RichTextDoc | null | undefined): string[] {
  const used = new Map<string, number>();
  return (doc?.content ?? [])
    .filter((node) => node.type === 'heading')
    .map((node) => {
      const base = slugify(textOf(node).trim());
      const count = (used.get(base) ?? 0) + 1;
      used.set(base, count);
      return count > 1 ? `${base}-${count}` : base;
    });
}
