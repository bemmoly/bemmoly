import type { Actor, CollabAccess, CollabDocumentDefinition, RequestContext } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import { applyUpdate, Doc, encodeStateAsUpdate, encodeStateVector } from 'yjs';
import type { RichText } from '../../../../shared/common.ts';
import { requireDatabase, spaceResource, type DocsServiceDeps } from '../common.ts';
import { writePeriodicIfDue } from '../revisions/write.ts';
import { snapshotToUpdate, writeSnapshot } from './convert.ts';
import { extractPage, personOf } from './extract.ts';
import { appendUpdate, compactLog, logLength, mergeLog, readLog, seedState } from './log.ts';

/** The collab kind of a page body: documents are named `docs.page:<pageId>`. */
export const DOCS_PAGE_KIND = 'docs.page';
export const DOCS_COMPACT_JOB = 'docs.compact';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_COMPACT_THRESHOLD = 500;

/**
 * Page bodies as collaborative documents: who may open one (the page and space
 * capabilities), how it loads (page_state, the updates after it, or the page's snapshot
 * converted once), how updates are stored (page_updates, then a compaction job past the
 * threshold) and what happens once edits settle (extract.ts).
 */
export function createPageCollab(deps: DocsServiceDeps) {
  const sql = () => requireDatabase(deps);

  async function spaceOf(pageId: string): Promise<string | null> {
    const [page] = await sql()<{ space_id: string }[]>`
      select space_id from pages where id = ${pageId} and deleted_at is null`;
    return page?.space_id ?? null;
  }

  /** The stored document, converting the page's snapshot the first time it is opened. */
  async function load(pageId: string): Promise<Uint8Array | null> {
    const stored = mergeLog(await readLog(sql(), pageId));
    if (stored) return stored;
    const [page] = await sql()<{ snapshot: RichText | null }[]>`
      select snapshot from pages where id = ${pageId} and deleted_at is null`;
    if (!page) throw new NotFoundError('The page was not found');
    if (!page.snapshot) return null;
    await seedState(sql(), pageId, snapshotToUpdate(page.snapshot));
    return mergeLog(await readLog(sql(), pageId));
  }

  /**
   * Once the log holds a threshold's worth of updates past page_state, ask for one compaction
   * per threshold's worth; the key collapses repeats while a job waits.
   */
  async function requestCompaction(pageId: string): Promise<void> {
    if (!deps.jobs) return;
    const threshold =
      (await deps.settings?.get('docs.compactThreshold')) ?? DEFAULT_COMPACT_THRESHOLD;
    const { seq, unfolded } = await logLength(sql(), pageId);
    if (unfolded < threshold) return;
    await deps.jobs.send(
      DOCS_COMPACT_JOB,
      { pageId },
      { idempotencyKey: `${DOCS_COMPACT_JOB}:${pageId}:${Math.floor(seq / threshold)}` },
    );
  }

  const definition: CollabDocumentDefinition = {
    kind: DOCS_PAGE_KIND,
    async authorize(ctx: RequestContext, pageId: string): Promise<CollabAccess> {
      if (!UUID.test(pageId)) return 'deny';
      const spaceId = await spaceOf(pageId);
      if (!spaceId) return 'deny';
      const resource = spaceResource(spaceId);
      if (await ctx.authz.can(ctx.actor, 'docs.page.edit', resource)) return 'write';
      if (await ctx.authz.can(ctx.actor, 'docs.page.view', resource)) return 'read';
      return 'deny';
    },
    load,
    async store(pageId, update, actor) {
      await appendUpdate(sql(), pageId, update, personOf(actor));
    },
    async onChange(change) {
      await extractPage(deps, change);
      await requestCompaction(change.id);
    },
  };

  return {
    definition,

    /**
     * The docs.compact job: folds the page's log into page_state. A page busy enough to need
     * compacting is being edited, so this is also a moment to take the periodic revision.
     */
    async compact(pageId: string) {
      const folded = await compactLog(sql(), pageId);
      await sql().begin((tx) => writePeriodicIfDue(tx, pageId));
      return folded;
    },

    /**
     * Replaces a page body from the server, for the deprecated snapshot field of
     * PATCH /pages/:id. Through the collab host when it runs, so open editors see it;
     * otherwise straight onto the stored log, then extracted as an edit would be.
     */
    async replaceContent(pageId: string, snapshot: RichText, actor: Actor): Promise<void> {
      if (deps.collab) {
        await deps.collab.transact(
          DOCS_PAGE_KIND,
          pageId,
          (doc) => writeSnapshot(doc, snapshot),
          actor,
        );
        return;
      }
      const doc = new Doc();
      const stored = await load(pageId);
      if (stored) applyUpdate(doc, stored);
      const before = encodeStateVector(doc);
      writeSnapshot(doc, snapshot);
      await definition.store(pageId, encodeStateAsUpdate(doc, before), actor);
      await extractPage(deps, { id: pageId, doc, editors: [actor] });
      doc.destroy();
    },
  };
}

export type PageCollab = ReturnType<typeof createPageCollab>;
