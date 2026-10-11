import type { Node as PmNode } from '@tiptap/pm/model';
import type { Mappable } from '@tiptap/pm/transform';

/*
 * A stretch of the page an AI write is about, followed through edits while the card is open.
 * Mapping alone is not enough on a shared page: the collaboration binding applies other
 * people's edits as one replacement of the whole document, which maps every position to its
 * edge. So the text is kept with the range; after an edit the mapped range must still read
 * as that text, or the text is found again in its line, nearest where it was. When it cannot
 * be found it is lost, and the card says so rather than replacing the wrong words.
 */

export interface Tracked {
  from: number;
  to: number;
  text: string;
}

/** Inline leaves (a mention, a page link) read as one character, the size they take. */
const LEAF = '￼';

export const textOf = (doc: PmNode, from: number, to: number) =>
  doc.textBetween(from, to, '\n', LEAF);

export function trackRange(doc: PmNode, from: number, to: number): Tracked {
  return { from, to, text: textOf(doc, from, to) };
}

const reads = (doc: PmNode, range: Tracked) =>
  range.from >= 0 &&
  range.to <= doc.content.size &&
  range.from <= range.to &&
  textOf(doc, range.from, range.to) === range.text;

/** The occurrence of `text` inside one line nearest `near`, or null. */
function find(doc: PmNode, text: string, near: number): Tracked | null {
  if (!text || text.includes('\n')) return null;
  let best: Tracked | null = null;
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const line = node.textBetween(0, node.content.size, '\n', LEAF);
    for (let at = line.indexOf(text); at >= 0; at = line.indexOf(text, at + 1)) {
      const from = pos + 1 + at;
      if (!best || Math.abs(from - near) < Math.abs(best.from - near)) {
        best = { from, to: from + text.length, text };
      }
    }
    return false;
  });
  return best;
}

/** The range after an edit: mapped, or found again by its text, or null when it is gone. */
export function followRange(doc: PmNode, range: Tracked, mapping: Mappable): Tracked | null {
  const mapped = {
    from: mapping.map(range.from, 1),
    to: mapping.map(range.to, -1),
    text: range.text,
  };
  if (mapped.to < mapped.from) mapped.to = mapped.from;
  if (reads(doc, mapped)) return mapped;
  if (reads(doc, range)) return range;
  return find(doc, range.text, mapped.from);
}

/** The end of the top-level block holding `pos`: where Insert writes. */
export function afterBlock(doc: PmNode, pos: number): number {
  const $pos = doc.resolve(Math.min(Math.max(pos, 0), doc.content.size));
  return $pos.depth >= 1 ? $pos.after(1) : $pos.pos;
}
