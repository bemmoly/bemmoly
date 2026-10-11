import type { RequestContext } from '@bemmoly/core';
import { NotFoundError, ProviderError } from '@bemmoly/shared';
import type { PageDetail } from '../../../../shared/pages.ts';
import type {
  CreateFromTemplateBody,
  CreateTemplateBody,
  ListTemplatesQuery,
  TemplateDetail,
  TemplateSummary,
  UpdateTemplateBody,
} from '../../../../shared/templates.ts';
import {
  DOCS_MODULE,
  DOCS_REALTIME_KINDS,
  publishChange,
  recordAudit,
  requireDatabase,
  spaceResource,
  userIdOf,
  type DocsServiceDeps,
} from '../common.ts';
import type { PagesService } from '../pages/index.ts';
import { createOrgTemplates } from './org.ts';
import {
  assertEditable,
  authorizeTemplateWrite,
  templateById,
  toDetail,
  toSummary,
  type TemplateRow,
} from './rows.ts';

/*
 * Org templates (space_id null, the six built-ins among them) are readable by
 * anyone with Docs and changed only by those who manage org templates
 * (docs.templates.manage, org admins by default); a space's own templates are
 * read by its members and changed by its configurers. Built-ins read only:
 * they are ordered, archived or duplicated, never rewritten or deleted.
 */
export function createTemplatesService(deps: DocsServiceDeps & { pages: PagesService }) {
  const authorizeRead = async (ctx: RequestContext, spaceId: string | null) =>
    ctx.authz.authorize(
      ctx.actor,
      'docs.page.view',
      spaceId ? spaceResource(spaceId) : DOCS_MODULE,
    );

  const changed = async (spaceId: string | null, id: string) => {
    if (spaceId) await publishChange(deps, DOCS_REALTIME_KINDS.templates, spaceId, [id]);
  };

  return {
    ...createOrgTemplates(deps),

    async list(ctx: RequestContext, query: ListTemplatesQuery): Promise<TemplateSummary[]> {
      await authorizeRead(ctx, query.spaceId ?? null);
      const sql = requireDatabase(deps);
      const rows = await sql<TemplateRow[]>`
        select * from templates
        where archived_at is null
          and (space_id is null or space_id = ${query.spaceId ?? null}::uuid)
        order by space_id nulls first, position, lower(name)`;
      return rows.map(toSummary);
    },

    async get(ctx: RequestContext, id: string): Promise<TemplateDetail> {
      const row = await templateById(requireDatabase(deps), id);
      await authorizeRead(ctx, row.space_id);
      return toDetail(row);
    },

    async create(ctx: RequestContext, body: CreateTemplateBody): Promise<TemplateDetail> {
      const sql = requireDatabase(deps);
      await authorizeTemplateWrite(ctx, { space_id: body.spaceId });
      const [row] = await sql<TemplateRow[]>`
        insert into templates (space_id, name, description, icon, category, snapshot, fields,
          position, created_by)
        values (${body.spaceId}, ${body.name}, ${body.description ?? null}, ${body.icon ?? null},
          ${body.category ?? null}, ${JSON.stringify(body.snapshot)}::jsonb,
          ${JSON.stringify(body.fields ?? [])}::jsonb,
          (select coalesce(max(position) + 1, 0) from templates
           where space_id is not distinct from ${body.spaceId}::uuid),
          ${userIdOf(ctx)}::uuid)
        returning *`;
      if (!row) throw new ProviderError('The template was not stored');
      await recordAudit(deps, ctx, {
        action: 'template.created',
        kind: 'template',
        id: row.id,
        after: toSummary(row),
      });
      await changed(body.spaceId, row.id);
      return toDetail(row);
    },

    async update(
      ctx: RequestContext,
      id: string,
      patch: UpdateTemplateBody,
    ): Promise<TemplateDetail> {
      const sql = requireDatabase(deps);
      const before = await templateById(sql, id);
      await authorizeTemplateWrite(ctx, before);
      assertEditable(before);
      const has = (field: keyof UpdateTemplateBody) => patch[field] !== undefined;
      const [row] = await sql<TemplateRow[]>`
        update templates set
          name = coalesce(${patch.name ?? null}, name),
          description = case when ${has('description')} then ${patch.description ?? null} else description end,
          icon = coalesce(${patch.icon ?? null}, icon),
          category = coalesce(${patch.category ?? null}, category),
          snapshot = coalesce(${patch.snapshot ? JSON.stringify(patch.snapshot) : null}::jsonb, snapshot),
          fields = coalesce(${patch.fields ? JSON.stringify(patch.fields) : null}::jsonb, fields),
          updated_at = now()
        where id = ${id}
        returning *`;
      if (!row) throw new ProviderError('The template was not updated');
      await recordAudit(deps, ctx, {
        action: 'template.updated',
        kind: 'template',
        id,
        before: toSummary(before),
        after: toSummary(row),
      });
      await changed(row.space_id, id);
      return toDetail(row);
    },

    async remove(ctx: RequestContext, id: string): Promise<void> {
      const sql = requireDatabase(deps);
      const row = await templateById(sql, id);
      await authorizeTemplateWrite(ctx, row);
      assertEditable(row);
      await sql`delete from templates where id = ${id}`;
      await recordAudit(deps, ctx, {
        action: 'template.deleted',
        kind: 'template',
        id,
        before: toSummary(row),
      });
      await changed(row.space_id, id);
    },

    /** A new page that starts as a copy of the template's document, titled after it by default. */
    async createPage(
      ctx: RequestContext,
      id: string,
      body: CreateFromTemplateBody,
    ): Promise<PageDetail> {
      const template = await templateById(requireDatabase(deps), id);
      if (template.space_id && template.space_id !== body.spaceId) {
        throw new NotFoundError('The template was not found in this space');
      }
      return deps.pages.create(ctx, {
        spaceId: body.spaceId,
        parentId: body.parentId ?? null,
        title: body.title ?? template.name,
        templateId: id,
      });
    },
  };
}

export type TemplatesService = ReturnType<typeof createTemplatesService>;
