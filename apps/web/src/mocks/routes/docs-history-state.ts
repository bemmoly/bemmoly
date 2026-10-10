import type { MockDb } from '../db.ts';
import { USER_IDS } from '../seed/people.ts';
import { ago, uid } from '../seed/time.ts';
import type { MockPage } from '../seed/docs.ts';
import type { PmNode } from './docs-diff.ts';
import { docsState } from './docs-state.ts';

/*
 * Version history and comments of the in-memory backend, one store per MockDb. The RFC
 * page comes with three versions that differ in every way the compare view draws, and with
 * threads like the Doc Editor mock's: one with a suggested fix, one whose text changed, a
 * page-level one and a resolved one.
 */

export interface MockRevision {
  id: string;
  pageId: string;
  number: number;
  kind: 'named' | 'periodic' | 'publish' | 'restore';
  label: string | null;
  title: string;
  snapshot: PmNode;
  authorIds: string[];
  createdBy: string | null;
  createdAt: string;
}

export interface MockComment {
  id: string;
  pageId: string;
  parentId: string | null;
  authorId: string | null;
  body: PmNode;
  anchor: { from: string; to: string; quote: string } | null;
  aiSuggestion: { replacement: string; rationale?: string; appliedAt?: string | null } | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  editedAt: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface HistoryState {
  revisions: MockRevision[];
  comments: MockComment[];
}

const RFC_PAGE = uid(5101);
const states = new WeakMap<MockDb, HistoryState>();

/** A page's body as stored, or its one-line text as a paragraph. */
export function snapshotOf(page: MockPage): PmNode {
  return (
    (page.snapshot as PmNode | undefined) ?? {
      type: 'doc',
      content: [
        page.text
          ? { type: 'paragraph', content: [{ type: 'text', text: page.text }] }
          : { type: 'paragraph' },
      ],
    }
  );
}

/** Replaces a page's body, as the collab server's store does: word count and edit time too. */
export function writeBody(page: MockPage, snapshot: object): void {
  const at = new Date().toISOString();
  page.snapshot = JSON.parse(JSON.stringify(snapshot)) as object;
  page.wordCount = textOf(page.snapshot as PmNode)
    .split(/\s+/)
    .filter(Boolean).length;
  page.contentUpdatedAt = at;
  page.updatedAt = at;
}

/** The readable text of a body, blocks on their own lines. */
export function textOf(node: PmNode): string {
  if (node.text !== undefined) return node.text;
  const inner = (node.content ?? []).map(textOf);
  return node.content?.every((child) => child.text !== undefined || !child.content)
    ? inner.join('')
    : inner.join('\n');
}

export const doc = (text: string): PmNode => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Replaces the first occurrence of `from` in any text node of the body. */
export function replaceText(body: PmNode, from: string, to: string): boolean {
  if (body.text?.includes(from)) {
    body.text = body.text.replace(from, to);
    return true;
  }
  return (body.content ?? []).some((child) => replaceText(child, from, to));
}

/** Older versions of the RFC: before the backfill section, with 30 minutes, steps reordered. */
function rfcHistory(page: MockPage): MockRevision[] {
  const now = snapshotOf(page);
  const first = clone(now);
  first.content = (first.content ?? []).filter(
    (block) => !textOf(block).startsWith('Backfill') && !textOf(block).startsWith('Once the flag'),
  );
  replaceText(first, '15 minutes', '30 minutes');
  const list = first.content.find((block) => block.type === 'orderedList');
  if (list?.content)
    list.content = [list.content[1]!, list.content[0]!, ...list.content.slice(2, 3)];
  const second = clone(now);
  replaceText(second, 'Redis stays warm for 7 days', 'Redis stays warm for a week');
  const revision = (
    number: number,
    kind: MockRevision['kind'],
    label: string | null,
    snapshot: PmNode,
    minutes: number,
    author: string,
  ): MockRevision => ({
    id: uid(9300 + number),
    pageId: page.id,
    number,
    kind,
    label,
    title: page.title,
    snapshot,
    authorIds: [author],
    createdBy: author,
    createdAt: ago(minutes),
  });
  return [
    revision(1, 'periodic', null, first, 60 * 24 * 6, USER_IDS.priya),
    revision(2, 'named', 'Before review', second, 60 * 24 * 2, USER_IDS.priya),
    revision(3, 'publish', null, clone(now), 60 * 5, USER_IDS.jonas),
  ];
}

function rfcComments(): MockComment[] {
  const comment = (n: number, fields: Partial<MockComment>): MockComment => ({
    id: uid(9400 + n),
    pageId: RFC_PAGE,
    parentId: null,
    authorId: USER_IDS.jonas,
    body: doc(''),
    anchor: null,
    aiSuggestion: null,
    resolvedAt: null,
    resolvedBy: null,
    editedAt: null,
    createdAt: ago(60 * 24),
    deletedAt: null,
    ...fields,
  });
  const anchor = (quote: string) => ({ from: 'AA==', to: 'AA==', quote });
  return [
    comment(1, {
      body: doc('Rollback says 15 min but the flag TTL in code is 30. Which is it?'),
      anchor: anchor('stay valid for 15 minutes'),
      aiSuggestion: {
        replacement: 'stay valid for 30 minutes',
        rationale: 'Code says 30 (auth/flags.go:41).',
      },
    }),
    comment(2, {
      parentId: uid(9401),
      authorId: USER_IDS.priya,
      body: doc('Checking with Aisha before I change it.'),
      createdAt: ago(60 * 20),
    }),
    comment(3, {
      body: doc('This needs an issue; nobody owns it.'),
      anchor: anchor('Remove the legacy cookie path'),
      createdAt: ago(60 * 22),
    }),
    comment(4, {
      authorId: USER_IDS.aisha,
      body: doc('Done on staging, backfill verified.'),
      anchor: anchor('Dual-write sessions'),
      createdAt: ago(60 * 60),
      resolvedAt: ago(60 * 30),
      resolvedBy: USER_IDS.aisha,
    }),
    comment(5, {
      authorId: USER_IDS.lena,
      body: doc('Looks good overall. Can we add a testing plan?'),
      createdAt: ago(60 * 3),
    }),
    comment(6, {
      authorId: USER_IDS.priya,
      body: doc('The old wording said "session cache" here.'),
      anchor: anchor('session cache flush'),
      createdAt: ago(60 * 26),
    }),
  ];
}

export function historyState(db: MockDb): HistoryState {
  let state = states.get(db);
  if (!state) {
    const rfc = docsState(db).pages.find((page) => page.id === RFC_PAGE);
    state = { revisions: rfc ? rfcHistory(rfc) : [], comments: rfc ? rfcComments() : [] };
    states.set(db, state);
  }
  return state;
}
