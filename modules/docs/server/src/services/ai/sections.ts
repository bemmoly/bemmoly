import { collectReferences, plainText, slugify } from '@bemmoly/editor/convert';
import type { RichText } from '../../../../shared/common.ts';

/*
 * A page body read the way a person reads it: top-level blocks grouped under the heading
 * above them, each paragraph numbered from 0 across the page, with the issue keys it embeds
 * or names. The consistency check pairs those keys with their paragraph; pageContext cites
 * each section by its heading anchor.
 */

export interface PageParagraph {
  /** The paragraph's index on the page, headings not counted. */
  index: number;
  text: string;
  /** Issue keys embedded in or named by the paragraph, in order, once each. */
  issueKeys: string[];
}

export interface PageSection {
  /** Null for the text before the first heading. */
  heading: string | null;
  /** The heading's anchor ("rollback", "rollback-2"), or null. */
  anchor: string | null;
  paragraphs: PageParagraph[];
}

type Block = { type?: string; content?: Block[]; attrs?: Record<string, unknown> };

const ISSUE_KEY = /\b[A-Z][A-Z0-9]{1,9}-[1-9]\d*\b/g;

function keysOf(block: Block, text: string): string[] {
  const keys: string[] = [];
  const refs = collectReferences({ type: 'doc', content: [block] } as Parameters<
    typeof collectReferences
  >[0]);
  for (const ref of refs) if (ref.kind === 'issue') keys.push(ref.key.trim().toUpperCase());
  for (const match of text.match(ISSUE_KEY) ?? []) keys.push(match);
  return [...new Set(keys)];
}

export function pageSections(snapshot: RichText | null): PageSection[] {
  const blocks = ((snapshot as Block | null)?.content ?? []) as Block[];
  const sections: PageSection[] = [{ heading: null, anchor: null, paragraphs: [] }];
  const used = new Map<string, number>();
  let index = 0;
  for (const block of blocks) {
    const text = plainText(block as Parameters<typeof plainText>[0]).trim();
    if (block.type === 'heading') {
      const base = slugify(text);
      const count = (used.get(base) ?? 0) + 1;
      used.set(base, count);
      sections.push({
        heading: text || 'Untitled section',
        anchor: count > 1 ? `${base}-${count}` : base,
        paragraphs: [],
      });
      continue;
    }
    const issueKeys = keysOf(block, text);
    if (!text && issueKeys.length === 0) continue;
    sections.at(-1)!.paragraphs.push({ index, text, issueKeys });
    index += 1;
  }
  return sections.filter((section) => section.heading !== null || section.paragraphs.length > 0);
}

/** Every (issue key, paragraph) pair on the page, in reading order. */
export function issueParagraphPairs(
  sections: readonly PageSection[],
): { key: string; section: PageSection; paragraph: PageParagraph }[] {
  return sections.flatMap((section) =>
    section.paragraphs.flatMap((paragraph) =>
      paragraph.issueKeys.map((key) => ({ key, section, paragraph })),
    ),
  );
}
