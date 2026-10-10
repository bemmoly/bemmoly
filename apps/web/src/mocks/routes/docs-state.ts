import type { MockDb } from '../db.ts';
import { seedDocsTemplates } from '../seed/docs-templates.ts';
import { seedDocsPages, seedDocsSpaces, type MockPage, type MockSpace } from '../seed/docs.ts';

/*
 * The Docs store of the in-memory backend, one per MockDb, and the
 * presenters that turn its rows into the Docs server's response shapes.
 * Apps never import a module, so the shapes are written out here.
 */

export interface DocsState {
  spaces: MockSpace[];
  pages: MockPage[];
  templates: ReturnType<typeof seedDocsTemplates>;
  /** userId → page ids, newest star last. */
  stars: Map<string, string[]>;
}

const states = new WeakMap<MockDb, DocsState>();

export function docsState(db: MockDb): DocsState {
  let state = states.get(db);
  if (!state) {
    state = {
      spaces: seedDocsSpaces(),
      pages: seedDocsPages(),
      templates: seedDocsTemplates(),
      stars: new Map(),
    };
    states.set(db, state);
  }
  return state;
}

const live = (page: MockPage) => page.deletedAt === null;

export function spaceByRef(state: DocsState, ref: string): MockSpace | undefined {
  return state.spaces.find((space) => space.id === ref || space.key === ref.toUpperCase());
}

export function presentSpace(state: DocsState, space: MockSpace) {
  const pageCount = state.pages.filter((page) => page.spaceId === space.id && live(page)).length;
  const topPages = childrenOf(state, space.id, null)
    .slice(0, 3)
    .map((page) => ({ id: page.id, title: page.title, icon: page.icon }));
  return { ...space, pageCount, topPages };
}

export function presentSummary(state: DocsState, page: MockPage) {
  const space = state.spaces.find((row) => row.id === page.spaceId);
  return {
    id: page.id,
    spaceId: page.spaceId,
    spaceKey: space?.key ?? 'DOC',
    parentId: page.parentId,
    position: page.position,
    depth: page.path.split('/').length - 3,
    title: page.title,
    icon: page.icon,
    status: page.status,
    ownerId: page.ownerId,
    hasChildren: state.pages.some((row) => row.parentId === page.id && live(row)),
    wordCount: page.wordCount,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    deletedAt: page.deletedAt,
  };
}

export function presentDetail(
  state: DocsState,
  page: MockPage,
  userId: string | null,
  ownerName: string | null,
) {
  const ancestors = page.path.split('/').filter((id) => id && id !== page.id);
  return {
    ...presentSummary(state, page),
    snapshot: page.snapshot ?? {
      type: 'doc',
      content: [
        page.text
          ? { type: 'paragraph', content: [{ type: 'text', text: page.text }] }
          : { type: 'paragraph' },
      ],
    },
    tldr: null,
    reviewers: page.reviewers,
    templateId: page.templateId,
    labels: page.labels,
    starred: userId ? (state.stars.get(userId) ?? []).includes(page.id) : false,
    version: page.version,
    breadcrumbs: ancestors.flatMap((id) => {
      const row = state.pages.find((item) => item.id === id);
      return row ? [{ id: row.id, title: row.title, icon: row.icon }] : [];
    }),
    owner: page.ownerId && ownerName ? { id: page.ownerId, name: ownerName } : null,
    createdBy: page.ownerId,
    updatedBy: page.ownerId,
    publishedAt: page.status === 'published' ? page.updatedAt : null,
    contentUpdatedAt: page.contentUpdatedAt,
  };
}

/** Siblings in tree order, live only. */
export function childrenOf(state: DocsState, spaceId: string, parentId: string | null) {
  return state.pages
    .filter((page) => page.spaceId === spaceId && page.parentId === parentId && live(page))
    .sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0));
}

/** A lexorank after the last sibling: the mock appends; the server places exactly. */
export function nextPosition(siblings: readonly MockPage[]): string {
  const last = siblings.at(-1)?.position;
  return last ? `${last}n` : 'n';
}

export { live };
