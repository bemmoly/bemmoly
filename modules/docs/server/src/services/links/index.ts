import type { EntitySummary, RequestContext } from '@bemmoly/core';
import { NotFoundError, ValidationError } from '@bemmoly/shared';
import type {
  BacklinksResponse,
  LinkedRecord,
  OutgoingLink,
  OutgoingLinksResponse,
  PageReferencesResponse,
  ReferencesQuery,
  SetLinksBody,
} from '../../../../shared/links.ts';
import {
  DOCS_REALTIME_KINDS,
  publishChange,
  recordAudit,
  requireDatabase,
  spaceResource,
  userIdOf,
  visibleSpaceIds,
  type DocsServiceDeps,
} from '../common.ts';
import { pageById } from '../pages/rows.ts';
import { pagePath } from '../palette/index.ts';
import { foreignSources, outgoingRows, pagesPointingAt, toLinkedPage } from './queries.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toRecord = (summary: EntitySummary): LinkedRecord => ({
  kind: summary.kind,
  id: summary.id,
  ...(summary.key ? { key: summary.key } : {}),
  title: summary.title,
  path: summary.path,
});

/**
 * The links graph as the panels read it: what a page points at, the pages and the other
 * modules' records that point back, and the pages that point at a record. Docs' own entity
 * ("page") and reference source ("docs.page") for other modules live here too.
 */
export function createLinksService(deps: DocsServiceDeps) {
  const sql = () => requireDatabase(deps);

  async function viewable(ctx: RequestContext, pageId: string) {
    const page = await pageById(sql(), pageId);
    await ctx.authz.authorize(ctx.actor, 'docs.page.view', spaceResource(page.space_id));
    return page;
  }

  const record = async (ctx: RequestContext, kind: string, id: string) => {
    const found = await deps.entities?.resolve(kind, { id }, ctx);
    return found ? toRecord(found) : null;
  };

  async function outgoing(ctx: RequestContext, pageId: string): Promise<OutgoingLinksResponse> {
    await viewable(ctx, pageId);
    const visible = await visibleSpaceIds(sql(), ctx);
    const items: OutgoingLink[] = [];
    for (const row of await outgoingRows(sql(), pageId)) {
      const edge = { targetKind: row.target_kind, targetId: row.target_id, kind: row.kind };
      if (row.target_kind === 'page') {
        if (!row.page_id || (visible && !visible.includes(row.space_id ?? ''))) continue;
        const page = {
          pageId: row.page_id,
          spaceKey: row.space_key ?? '',
          title: row.title ?? '',
          icon: row.icon,
          status: row.status ?? 'draft',
        };
        items.push({ ...edge, page, record: null });
      } else {
        const found = await record(ctx, row.target_kind, row.target_id);
        if (found) items.push({ ...edge, page: null, record: found });
      }
    }
    return { items };
  }

  /** Pages that point at a record, filtered to the person's spaces. */
  async function pagesLinkingTo(
    ctx: RequestContext,
    target: { kind: 'page' | 'issue'; id: string },
  ) {
    const visible = await visibleSpaceIds(sql(), ctx);
    return (await pagesPointingAt(sql(), target, visible)).map(toLinkedPage);
  }

  return {
    outgoing,

    async backlinks(ctx: RequestContext, pageId: string): Promise<BacklinksResponse> {
      await viewable(ctx, pageId);
      return { items: await pagesLinkingTo(ctx, { kind: 'page', id: pageId }) };
    },

    /**
     * "Referenced in": records of other modules that point at the page. Edges stored here
     * come first; then whatever other modules answer through the kernel's reference
     * sources (Work's issues whose description links the page), each record once.
     */
    async references(ctx: RequestContext, pageId: string): Promise<PageReferencesResponse> {
      await viewable(ctx, pageId);
      const items: PageReferencesResponse['items'] = [];
      const seen = new Set<string>();
      for (const row of await foreignSources(sql(), pageId)) {
        const found = await record(ctx, row.source_kind, row.source_id);
        if (!found) continue;
        seen.add(`${found.kind}:${found.id}`);
        items.push({ ...found, linkKind: row.kind });
      }
      const groups = (await deps.links?.referencesTo(ctx, { kind: 'page', id: pageId })) ?? [];
      for (const group of groups) {
        if (group.moduleId === 'docs') continue;
        for (const item of group.items) {
          if (seen.has(`${item.kind}:${item.id}`)) continue;
          seen.add(`${item.kind}:${item.id}`);
          items.push({ ...toRecord(item), linkKind: 'mention' });
        }
      }
      return { items };
    },

    /** "Linked docs" for a record: an issue by key or id, or a page by id. */
    async linkedDocs(ctx: RequestContext, query: ReferencesQuery): Promise<BacklinksResponse> {
      let id = query.id;
      if (query.kind === 'page') {
        if (!id) throw new ValidationError('A page is named by its id');
        await viewable(ctx, id);
      } else {
        const found = await deps.entities?.resolve(
          query.kind,
          query.key ? { key: query.key } : { id: id! },
          ctx,
        );
        if (!found) throw new NotFoundError(`The ${query.kind} was not found`);
        id = found.id;
      }
      return { items: await pagesLinkingTo(ctx, { kind: query.kind, id }) };
    },

    /** Replaces the page's hand-made links; body links follow the body, not this call. */
    async setLinked(
      ctx: RequestContext,
      pageId: string,
      body: SetLinksBody,
    ): Promise<OutgoingLinksResponse> {
      const page = await pageById(sql(), pageId);
      await ctx.authz.authorize(ctx.actor, 'docs.page.edit', spaceResource(page.space_id));
      const visible = await visibleSpaceIds(sql(), ctx);
      const unique = [
        ...new Map(body.links.map((l) => [`${l.targetKind}:${l.targetId}`, l])).values(),
      ];
      for (const link of unique) {
        if (link.targetKind === 'page') {
          if (link.targetId === pageId) throw new ValidationError('A page cannot link to itself');
          const [target] = await sql()<{ space_id: string }[]>`
            select space_id from pages where id = ${link.targetId} and deleted_at is null`;
          if (!target || (visible && !visible.includes(target.space_id))) {
            throw new ValidationError('A linked page was not found', {
              details: { targetId: link.targetId },
            });
          }
        } else if (!(await record(ctx, link.targetKind, link.targetId))) {
          throw new ValidationError(`A linked ${link.targetKind} was not found`, {
            details: { targetId: link.targetId },
          });
        }
      }
      await sql().begin(async (tx) => {
        await tx`delete from links
          where source_kind = 'page' and source_id = ${pageId} and kind = 'linked'`;
        for (const link of unique) {
          await tx`
            insert into links (source_kind, source_id, target_kind, target_id, kind, created_by)
            values ('page', ${pageId}, ${link.targetKind}, ${link.targetId}, 'linked',
              ${userIdOf(ctx)}::uuid)`;
        }
        await recordAudit(
          deps,
          ctx,
          { action: 'page.links_changed', kind: 'page', id: pageId, after: { links: unique } },
          tx,
        );
      });
      await publishChange(deps, DOCS_REALTIME_KINDS.links, page.space_id, [pageId]);
      return outgoing(ctx, pageId);
    },

    /** The kernel entity "page": any module may name a page by id. */
    async resolvePage(ref: { id: string } | { key: string }): Promise<EntitySummary | null> {
      if (!('id' in ref) || !UUID.test(ref.id)) return null;
      const [row] = await sql()<{ id: string; title: string }[]>`
        select id, title from pages where id = ${ref.id} and deleted_at is null`;
      return row ? { kind: 'page', id: row.id, title: row.title, path: pagePath(row.id) } : null;
    },

    async canViewPage(ctx: RequestContext, pageId: string): Promise<boolean> {
      const [row] = await sql()<{ space_id: string }[]>`
        select space_id from pages where id = ${pageId} and deleted_at is null`;
      return row ? ctx.authz.can(ctx.actor, 'docs.page.view', spaceResource(row.space_id)) : false;
    },

    /** The kernel reference source "docs.page": pages that point at another module's record. */
    async referencesTo(
      ctx: RequestContext,
      target: { kind: string; id: string },
    ): Promise<EntitySummary[]> {
      if ((target.kind !== 'issue' && target.kind !== 'page') || !UUID.test(target.id)) return [];
      const pages = await pagesLinkingTo(ctx, { kind: target.kind, id: target.id });
      return pages.map((page) => ({
        kind: 'page',
        id: page.pageId,
        key: page.spaceKey,
        title: page.title,
        path: pagePath(page.pageId),
      }));
    },
  };
}

export type LinksService = ReturnType<typeof createLinksService>;
