import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { ConflictError, NotFoundError, ProviderError } from '@bemmoly/shared';
import type { RichText } from '../../../../shared/common.ts';
import type { PageDetail } from '../../../../shared/pages.ts';
import type {
  CreateFromTemplateBody,
  CreateTemplateBody,
  ListTemplatesQuery,
  TemplateDetail,
  TemplateField,
  TemplateSummary,
  UpdateTemplateBody,
} from '../../../../shared/templates.ts';
import {
  DOCS_MODULE,
  DOCS_REALTIME_KINDS,
  iso,
  publishChange,
  recordAudit,
  requireDatabase,
  spaceResource,
  userIdOf,
  type DocsServiceDeps,
} from '../common.ts';
import type { PagesService } from '../pages/index.ts';

interface TemplateRow {
  id: string;
  space_id: string | null;
  key: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  fields: TemplateField[];
  is_builtin: boolean;
  position: number;
  snapshot: RichText;
  created_at: Date | string;
  updated_at: Date | string;
}

const toSummary = (row: TemplateRow): TemplateSummary => ({
  id: row.id,
  spaceId: row.space_id,
  key: row.key,
  name: row.name,
  description: row.description,
  icon: row.icon,
  category: row.category,
  fields: row.fields,
  isBuiltin: row.is_builtin,
  position: row.position,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

const toDetail = (row: TemplateRow): TemplateDetail => ({
  ...toSummary(row),
  snapshot: row.snapshot,
});

async function templateById(sql: SqlExecutor, id: string): Promise<TemplateRow> {
  const [row] = await sql<TemplateRow[]>`
    select * from templates where id = ${id} and archived_at is null`;
  if (!row) throw new NotFoundError('The template was not found');
  return row;
}

/*
 * Org templates (space_id null, the six built-ins among them) are readable
 * by anyone with Docs; a space's own templates by its members, and only its
 * configurers change them. Built-ins are never deleted, only edited.
 */
export function createTemplatesService(deps: DocsServiceDeps & { pages: PagesService }) {
  const authorizeRead = async (ctx: RequestContext, spaceId: string | null) =>
    ctx.authz.authorize(
      ctx.actor,
      'docs.page.view',
      spaceId ? spaceResource(spaceId) : DOCS_MODULE,
    );

  const authorizeWrite = async (ctx: RequestContext, row: Pick<TemplateRow, 'space_id'>) =>
    ctx.authz.authorize(
      ctx.actor,
      row.space_id ? 'docs.space.configure' : 'workspace.settings.manage',
      row.space_id ? spaceResource(row.space_id) : { kind: 'workspace', moduleId: 'docs' },
    );

  return {
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
      await authorizeWrite(ctx, { space_id: body.spaceId });
      const [row] = await sql<TemplateRow[]>`
        insert into templates (space_id, name, description, icon, category, snapshot, fields,
          position, created_by)
        values (${body.spaceId}, ${body.name}, ${body.description ?? null}, ${body.icon ?? null},
          ${body.category ?? null}, ${JSON.stringify(body.snapshot)}::jsonb,
          ${JSON.stringify(body.fields ?? [])}::jsonb,
          (select coalesce(max(position) + 1, 0) from templates where space_id = ${body.spaceId}),
          ${userIdOf(ctx)}::uuid)
        returning *`;
      if (!row) throw new ProviderError('The template was not stored');
      const after = toSummary(row);
      await recordAudit(deps, ctx, {
        action: 'template.created',
        kind: 'template',
        id: row.id,
        after,
      });
      await publishChange(deps, DOCS_REALTIME_KINDS.templates, body.spaceId, [row.id]);
      return toDetail(row);
    },

    async update(
      ctx: RequestContext,
      id: string,
      patch: UpdateTemplateBody,
    ): Promise<TemplateDetail> {
      const sql = requireDatabase(deps);
      const before = await templateById(sql, id);
      await authorizeWrite(ctx, before);
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
      if (row.space_id)
        await publishChange(deps, DOCS_REALTIME_KINDS.templates, row.space_id, [id]);
      return toDetail(row);
    },

    async remove(ctx: RequestContext, id: string): Promise<void> {
      const sql = requireDatabase(deps);
      const row = await templateById(sql, id);
      await authorizeWrite(ctx, row);
      if (row.is_builtin) throw new ConflictError('Built-in templates can be edited, not deleted');
      await sql`delete from templates where id = ${id}`;
      await recordAudit(deps, ctx, {
        action: 'template.deleted',
        kind: 'template',
        id,
        before: toSummary(row),
      });
      if (row.space_id)
        await publishChange(deps, DOCS_REALTIME_KINDS.templates, row.space_id, [id]);
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
