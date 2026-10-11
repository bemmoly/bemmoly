import { decodeCursor, toPage, type RequestContext } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import {
  CURRENT_REVISION,
  type CompareRevisionsQuery,
  type CreateRevisionBody,
  type ListRevisionsQuery,
  type RevisionCompare,
  type RevisionDetail,
  type RevisionSummary,
  type RevisionsPage,
} from '../../../../shared/revisions.ts';
import { diffDocs, type DiffNode } from '../../../../shared/diff/index.ts';
import {
  DOCS_REALTIME_KINDS,
  publishChange,
  recordAudit,
  requireDatabase,
  spaceResource,
  userIdOf,
  type DocsServiceDeps,
} from '../common.ts';
import type { PageCollab } from '../collab/index.ts';
import { pageById } from '../pages/rows.ts';
import {
  REVISION_COLUMNS,
  revisionById,
  toRevisionDetail,
  toRevisionSummary,
  type RevisionRow,
} from './rows.ts';
import { insertRevision } from './write.ts';

/**
 * Version history: list and open revisions, save one by hand, restore one
 * through the live document, and compare two (or one and the page as it is).
 */
export function createRevisionsService(deps: DocsServiceDeps, collab: PageCollab) {
  const sql = () => requireDatabase(deps);

  async function pageFor(
    ctx: RequestContext,
    pageId: string,
    capability: 'docs.page.view' | 'docs.page.edit',
  ) {
    const page = await pageById(sql(), pageId);
    await ctx.authz.authorize(ctx.actor, capability, spaceResource(page.space_id));
    return page;
  }

  async function announce(spaceId: string, pageId: string): Promise<void> {
    await publishChange(deps, DOCS_REALTIME_KINDS.revisions, spaceId, [pageId]);
  }

  return {
    async list(
      ctx: RequestContext,
      pageId: string,
      query: ListRevisionsQuery,
    ): Promise<RevisionsPage> {
      await pageFor(ctx, pageId, 'docs.page.view');
      const cursor = decodeCursor(query.cursor);
      if (query.cursor && !cursor) throw new ValidationError('The cursor is not valid');
      const rows = await sql()<RevisionRow[]>`
        select ${sql().unsafe(REVISION_COLUMNS)} from page_revisions
        where page_id = ${pageId} ${cursor ? sql()`and id < ${cursor}` : sql()``}
        order by id desc
        limit ${query.limit + 1}`;
      const page = toPage(rows, query.limit);
      return { items: page.rows.map(toRevisionSummary), nextCursor: page.nextCursor };
    },

    async get(ctx: RequestContext, pageId: string, revisionId: string): Promise<RevisionDetail> {
      await pageFor(ctx, pageId, 'docs.page.view');
      return toRevisionDetail(await revisionById(sql(), pageId, revisionId));
    },

    /** "Save version": the page as it is now, named or not. */
    async create(
      ctx: RequestContext,
      pageId: string,
      body: CreateRevisionBody,
    ): Promise<RevisionSummary> {
      const page = await pageFor(ctx, pageId, 'docs.page.edit');
      const row = await sql().begin(async (tx) => {
        const created = await insertRevision(tx, {
          pageId,
          kind: 'named',
          label: body.label ?? null,
          createdBy: userIdOf(ctx),
        });
        await recordAudit(
          deps,
          ctx,
          {
            action: 'page.revision_saved',
            kind: 'page',
            id: pageId,
            after: { number: created.number },
          },
          tx,
        );
        return created;
      });
      await announce(page.space_id, pageId);
      return toRevisionSummary(row);
    },

    /**
     * Makes a revision the page's content again. The change goes through the collab host,
     * so everyone with the page open sees it arrive as an edit, and is itself recorded as a
     * "restore" revision, so restoring is never destructive.
     */
    async restore(
      ctx: RequestContext,
      pageId: string,
      revisionId: string,
    ): Promise<RevisionSummary> {
      const page = await pageFor(ctx, pageId, 'docs.page.edit');
      const revision = await revisionById(sql(), pageId, revisionId);
      await collab.replaceContent(pageId, revision.snapshot, ctx.actor);
      const userId = userIdOf(ctx);
      const row = await sql().begin(async (tx) => {
        const created = await insertRevision(tx, {
          pageId,
          kind: 'restore',
          label: `Restored from v${revision.number}`,
          createdBy: userId,
          authorIds: userId ? [userId] : [],
          snapshot: revision.snapshot,
        });
        await recordAudit(
          deps,
          ctx,
          {
            action: 'page.revision_restored',
            kind: 'page',
            id: pageId,
            after: { restored: revision.number, number: created.number },
          },
          tx,
        );
        return created;
      });
      await announce(page.space_id, pageId);
      await publishChange(deps, DOCS_REALTIME_KINDS.page, page.space_id, [pageId]);
      return toRevisionSummary(row);
    },

    async compare(
      ctx: RequestContext,
      pageId: string,
      query: CompareRevisionsQuery,
    ): Promise<RevisionCompare> {
      const page = await pageFor(ctx, pageId, 'docs.page.view');
      const side = async (ref: string) => {
        if (ref === CURRENT_REVISION) {
          return { revision: null, title: page.title, snapshot: page.snapshot };
        }
        const row = await revisionById(sql(), pageId, ref);
        return { revision: toRevisionSummary(row), title: row.title, snapshot: row.snapshot };
      };
      const from = await side(query.from);
      const to = await side(query.to);
      return {
        pageId,
        from: { revision: from.revision, title: from.title },
        to: { revision: to.revision, title: to.title },
        diff: diffDocs(from.snapshot as DiffNode | null, to.snapshot as DiffNode | null),
      };
    },
  };
}

export type RevisionsService = ReturnType<typeof createRevisionsService>;
