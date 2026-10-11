import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { ConflictError, NotFoundError, ProviderError, ValidationError } from '@bemmoly/shared';
import type {
  OrgTemplate,
  ReorderTemplatesBody,
  TemplateDetail,
} from '../../../../shared/templates.ts';
import {
  DOCS_MODULE,
  DOCS_REALTIME_KINDS,
  publishChange,
  recordAudit,
  requireDatabase,
  userIdOf,
  type DocsServiceDeps,
} from '../common.ts';
import {
  anyTemplateById,
  authorizeTemplateWrite,
  MANAGE_ORG_TEMPLATES,
  templateById,
  toDetail,
  toOrgTemplate,
  toSummary,
  type OrgTemplateRow,
  type TemplateRow,
} from './rows.ts';

/** Room for " (copy)" after the longest name a template may have. */
const COPY_SUFFIX = ' (copy)';
const copyName = (name: string) => `${name.slice(0, 120 - COPY_SUFFIX.length)}${COPY_SUFFIX}`;

/** The org templates with their use and maker, or the one template `id` names. */
async function orgRows(sql: SqlExecutor, id: string | null): Promise<OrgTemplateRow[]> {
  return sql<OrgTemplateRow[]>`
    select t.*, u.name as creator_name,
      (select count(*) from pages p where p.template_id = t.id) as used_by
    from templates t
    left join users u on u.id = t.created_by
    where (${id}::uuid is null and t.space_id is null) or t.id = ${id}::uuid
    order by t.archived_at is not null, t.position, lower(t.name)`;
}

async function withUsage(sql: SqlExecutor, id: string): Promise<OrgTemplate> {
  const [row] = await orgRows(sql, id);
  if (!row) throw new NotFoundError('The template was not found');
  return toOrgTemplate(row);
}

/**
 * What Settings › Docs does to templates: the org list with the archived ones, archive and
 * restore (both reversible, so the screen offers Undo), duplicate (how a built-in becomes
 * editable) and the order the template picker shows. Archive, restore and duplicate also
 * work on a space's templates, under that space's configure right.
 */
export function createOrgTemplates(deps: DocsServiceDeps) {
  const changed = async (spaceId: string | null, id: string) => {
    if (spaceId) await publishChange(deps, DOCS_REALTIME_KINDS.templates, spaceId, [id]);
  };

  const setArchived = async (ctx: RequestContext, row: TemplateRow, archived: boolean) => {
    const sql = requireDatabase(deps);
    await sql`
      update templates
      set archived_at = case when ${archived} then now() else null end, updated_at = now()
      where id = ${row.id}`;
    await recordAudit(deps, ctx, {
      action: archived ? 'template.archived' : 'template.restored',
      kind: 'template',
      id: row.id,
      before: toSummary(row),
    });
    await changed(row.space_id, row.id);
    return withUsage(sql, row.id);
  };

  return {
    async listOrg(ctx: RequestContext): Promise<OrgTemplate[]> {
      await ctx.authz.authorize(ctx.actor, MANAGE_ORG_TEMPLATES, DOCS_MODULE);
      return (await orgRows(requireDatabase(deps), null)).map(toOrgTemplate);
    },

    async archive(ctx: RequestContext, id: string): Promise<OrgTemplate> {
      const row = await anyTemplateById(requireDatabase(deps), id);
      await authorizeTemplateWrite(ctx, row);
      if (row.archived_at) throw new ConflictError('The template is already archived');
      return setArchived(ctx, row, true);
    },

    async restore(ctx: RequestContext, id: string): Promise<OrgTemplate> {
      const row = await anyTemplateById(requireDatabase(deps), id);
      await authorizeTemplateWrite(ctx, row);
      if (!row.archived_at) throw new ConflictError('The template is not archived');
      return setArchived(ctx, row, false);
    },

    /** An editable copy, never built-in, placed right after the original. */
    async duplicate(ctx: RequestContext, id: string): Promise<TemplateDetail> {
      const sql = requireDatabase(deps);
      const source = await templateById(sql, id);
      await authorizeTemplateWrite(ctx, source);
      const row = await sql.begin(async (tx) => {
        await tx`
          update templates set position = position + 1
          where space_id is not distinct from ${source.space_id}::uuid
            and position > ${source.position}`;
        const [copy] = await tx<TemplateRow[]>`
          insert into templates (space_id, name, description, icon, category, snapshot, fields,
            position, created_by)
          select space_id, ${copyName(source.name)}, description, icon, category, snapshot,
            fields, ${source.position + 1}, ${userIdOf(ctx)}::uuid
          from templates where id = ${id}
          returning *`;
        return copy;
      });
      if (!row) throw new ProviderError('The copy was not stored');
      await recordAudit(deps, ctx, {
        action: 'template.created',
        kind: 'template',
        id: row.id,
        after: { ...toSummary(row), duplicateOf: id },
      });
      await changed(row.space_id, row.id);
      return toDetail(row);
    },

    /** Sets the picker's order: every active org template, each once, first to last. */
    async reorder(ctx: RequestContext, body: ReorderTemplatesBody): Promise<void> {
      await ctx.authz.authorize(ctx.actor, MANAGE_ORG_TEMPLATES, DOCS_MODULE);
      const sql = requireDatabase(deps);
      const active = await sql<{ id: string; position: number }[]>`
        select id, position from templates where space_id is null and archived_at is null`;
      const known = new Set(active.map((row) => row.id));
      const asked = new Set(body.ids);
      if (asked.size !== body.ids.length) {
        throw new ValidationError('Each template may appear only once in the order');
      }
      if (asked.size !== known.size || body.ids.some((id) => !known.has(id))) {
        throw new ConflictError(
          'The templates changed since the list loaded. Reload and try again.',
        );
      }
      await sql.begin(async (tx) => {
        for (const [position, id] of body.ids.entries()) {
          await tx`update templates set position = ${position} where id = ${id}`;
        }
      });
      await recordAudit(deps, ctx, {
        action: 'template.reordered',
        kind: 'template',
        id: body.ids[0] ?? '',
        before: active.toSorted((a, b) => a.position - b.position).map((row) => row.id),
        after: body.ids,
      });
    },
  };
}
