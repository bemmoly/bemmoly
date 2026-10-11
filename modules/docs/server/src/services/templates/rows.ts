import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { ConflictError, NotFoundError } from '@bemmoly/shared';
import type { RichText } from '../../../../shared/common.ts';
import type {
  OrgTemplate,
  TemplateDetail,
  TemplateField,
  TemplateSummary,
} from '../../../../shared/templates.ts';
import { DOCS_MODULE, iso, isoOrNull, spaceResource } from '../common.ts';

export interface TemplateRow {
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
  created_by: string | null;
  archived_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface OrgTemplateRow extends TemplateRow {
  used_by: number | string;
  creator_name: string | null;
}

export const toSummary = (row: TemplateRow): TemplateSummary => ({
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

export const toDetail = (row: TemplateRow): TemplateDetail => ({
  ...toSummary(row),
  snapshot: row.snapshot,
});

export const toOrgTemplate = (row: OrgTemplateRow): OrgTemplate => ({
  ...toSummary(row),
  usedBy: Number(row.used_by),
  createdBy:
    row.created_by && row.creator_name ? { id: row.created_by, name: row.creator_name } : null,
  archivedAt: isoOrNull(row.archived_at),
});

/** An active template; archived ones are gone for everyone but Settings › Docs. */
export async function templateById(sql: SqlExecutor, id: string): Promise<TemplateRow> {
  const [row] = await sql<TemplateRow[]>`
    select * from templates where id = ${id} and archived_at is null`;
  if (!row) throw new NotFoundError('The template was not found');
  return row;
}

/** Any template, archived or not, for restoring one. */
export async function anyTemplateById(sql: SqlExecutor, id: string): Promise<TemplateRow> {
  const [row] = await sql<TemplateRow[]>`select * from templates where id = ${id}`;
  if (!row) throw new NotFoundError('The template was not found');
  return row;
}

/** Whose a template is to change: org-wide ones the org admins', a space's its configurers'. */
export const MANAGE_ORG_TEMPLATES = 'docs.templates.manage';

export async function authorizeTemplateWrite(
  ctx: RequestContext,
  row: Pick<TemplateRow, 'space_id'>,
): Promise<void> {
  if (row.space_id) {
    await ctx.authz.authorize(ctx.actor, 'docs.space.configure', spaceResource(row.space_id));
    return;
  }
  await ctx.authz.authorize(ctx.actor, MANAGE_ORG_TEMPLATES, DOCS_MODULE);
}

/** The same question as authorizeTemplateWrite, answered rather than thrown. */
export async function canWriteTemplate(
  ctx: RequestContext,
  row: Pick<TemplateRow, 'space_id'>,
): Promise<boolean> {
  return row.space_id
    ? ctx.authz.can(ctx.actor, 'docs.space.configure', spaceResource(row.space_id))
    : ctx.authz.can(ctx.actor, MANAGE_ORG_TEMPLATES, DOCS_MODULE);
}

/** A built-in reads only: it can be ordered, archived or duplicated, never rewritten. */
export function assertEditable(row: Pick<TemplateRow, 'is_builtin'>): void {
  if (row.is_builtin) {
    throw new ConflictError('Built-in templates cannot be changed. Duplicate it to edit a copy.');
  }
}
