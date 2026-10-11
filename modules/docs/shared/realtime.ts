/*
 * Invalidation kinds the Docs services publish and the Docs hooks subscribe
 * to. Every message carries the space id as its scope; `ids` are the rows
 * that changed, so a hook can invalidate one query instead of a screen.
 */
export const DOCS_REALTIME_KINDS = {
  /** A space's name, settings or membership changed, or a space was created. */
  space: 'docs.space',
  /** A page's metadata, status, labels or content snapshot changed. */
  page: 'docs.page',
  /** The tree of a space changed: a page was created, moved, deleted or restored. */
  tree: 'docs.tree',
  /** A page's comments changed: added, edited, resolved, reopened, deleted or a fix applied. */
  comments: 'docs.comments',
  /** A page gained a revision (saved, published, periodic or restored). */
  revisions: 'docs.revisions',
  /** A page's outgoing links changed, so its targets' backlinks did too. */
  links: 'docs.links',
  /** A template was added, changed or removed. */
  templates: 'docs.templates',
} as const;

export type DocsRealtimeKind = (typeof DOCS_REALTIME_KINDS)[keyof typeof DOCS_REALTIME_KINDS];
