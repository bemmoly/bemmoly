import type { RequestContext, SqlClient } from '@bemmoly/core';
import { ConflictError, ProviderError, ValidationError } from '@bemmoly/shared';
import type {
  CreateIssueTypeBody,
  IssueType,
  IssueTypeField,
  PutIssueTypeFieldsBody,
  ReorderIssueTypesBody,
  UpdateIssueTypeBody,
} from '../../../../shared/issue-types.ts';
import { authorizeScope, resolveScope, scopeOfRow, writableProjectId } from '../projects/scope.ts';
import { putLayout, readLayout } from './layout.ts';
import {
  ISSUE_TYPE_COLUMNS,
  issueTypeIn,
  issueTypesOf,
  toIssueType,
  type IssueTypeRow,
} from './rows.ts';

export interface IssueTypesServiceDeps {
  database?: SqlClient;
}

const UNIQUE_VIOLATION = '23505';

/**
 * Issue types of the org (projectKey null) or of one project, which reads
 * its own copy once it has overridden the scheme and the org defaults until
 * then. Writes inside a project need the override first.
 */
export function createIssueTypesService(deps: IssueTypesServiceDeps) {
  const db = (): SqlClient => {
    if (!deps.database) throw new ProviderError('The work module needs the database');
    return deps.database;
  };

  async function forWrite(ctx: RequestContext, projectKey: string | null, id?: string) {
    const sql = db();
    const ref = id ? await scopeOfRow(sql, 'issue_types', projectKey, id) : projectKey;
    const scope = await resolveScope(sql, 'issue_types', ref);
    await authorizeScope(ctx, scope, true);
    return { sql, projectId: writableProjectId(scope, 'issue_types') };
  }

  return {
    async list(ctx: RequestContext, projectKey: string | null): Promise<{ items: IssueType[] }> {
      const sql = db();
      const scope = await resolveScope(sql, 'issue_types', projectKey);
      await authorizeScope(ctx, scope, false);
      return { items: (await issueTypesOf(sql, scope.rowsProjectId)).map(toIssueType) };
    },

    async create(
      ctx: RequestContext,
      projectKey: string | null,
      body: CreateIssueTypeBody,
    ): Promise<IssueType> {
      const { sql, projectId } = await forWrite(ctx, projectKey);
      try {
        const [row] = await sql<IssueTypeRow[]>`
          insert into issue_types (project_id, key, name, description, icon, color, level, position)
          values (${projectId}::uuid, ${body.key}, ${body.name}, ${body.description ?? null},
            ${body.icon ?? null}, ${body.color ?? null}, ${body.level ?? 'standard'},
            coalesce(${body.position ?? null}::integer,
              (select coalesce(max(position), -1) + 1 from issue_types
                where project_id is not distinct from ${projectId}::uuid)))
          returning ${sql.unsafe(ISSUE_TYPE_COLUMNS)}`;
        if (!row) throw new ProviderError('The issue type was not stored');
        return toIssueType(row);
      } catch (error) {
        if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
          throw new ConflictError(`An issue type with the key ${body.key} already exists`);
        }
        throw error;
      }
    },

    async update(
      ctx: RequestContext,
      projectKey: string | null,
      id: string,
      patch: UpdateIssueTypeBody,
    ): Promise<IssueType> {
      const { sql, projectId } = await forWrite(ctx, projectKey, id);
      await issueTypeIn(sql, projectId, id);
      const [row] = await sql<IssueTypeRow[]>`
        update issue_types set
          name = coalesce(${patch.name ?? null}, name),
          description = case when ${patch.description !== undefined} then ${patch.description ?? null} else description end,
          icon = coalesce(${patch.icon ?? null}, icon),
          color = coalesce(${patch.color ?? null}, color),
          level = coalesce(${patch.level ?? null}, level),
          position = coalesce(${patch.position ?? null}::integer, position),
          updated_at = now()
        where id = ${id}
        returning ${sql.unsafe(ISSUE_TYPE_COLUMNS)}`;
      if (!row) throw new ProviderError('The issue type was not updated');
      return toIssueType(row);
    },

    /** Positions follow the order given; every type of the scope must be named once. */
    async reorder(
      ctx: RequestContext,
      projectKey: string | null,
      body: ReorderIssueTypesBody,
    ): Promise<{ items: IssueType[] }> {
      const { sql, projectId } = await forWrite(ctx, projectKey);
      const current = await issueTypesOf(sql, projectId);
      const known = new Set(current.map((row) => row.id));
      const unique = new Set(body.ids);
      if (
        unique.size !== body.ids.length ||
        unique.size !== known.size ||
        ![...unique].every((x) => known.has(x))
      ) {
        throw new ValidationError('Name every issue type of this scope exactly once');
      }
      await sql`
        update issue_types as t set position = o.position, updated_at = now()
        from unnest(${body.ids}::uuid[]) with ordinality as o(id, position)
        where t.id = o.id`;
      return { items: (await issueTypesOf(sql, projectId)).map(toIssueType) };
    },

    /** Issues keep their type_id, so a type in use cannot go; the database says which. */
    async remove(ctx: RequestContext, projectKey: string | null, id: string): Promise<void> {
      const { sql, projectId } = await forWrite(ctx, projectKey, id);
      await issueTypeIn(sql, projectId, id);
      try {
        await sql`delete from issue_types where id = ${id}`;
      } catch (error) {
        if ((error as { code?: string }).code === '23503') {
          throw new ConflictError('Issues still use this type; move them first');
        }
        throw error;
      }
    },

    async layout(
      ctx: RequestContext,
      projectKey: string | null,
      id: string,
    ): Promise<{ items: IssueTypeField[] }> {
      const sql = db();
      const ref = await scopeOfRow(sql, 'issue_types', projectKey, id);
      const scope = await resolveScope(sql, 'issue_types', ref);
      await authorizeScope(ctx, scope, false);
      await issueTypeIn(sql, scope.rowsProjectId, id);
      return { items: await readLayout(sql, id) };
    },

    async putLayout(
      ctx: RequestContext,
      projectKey: string | null,
      id: string,
      body: PutIssueTypeFieldsBody,
    ): Promise<{ items: IssueTypeField[] }> {
      const { sql, projectId } = await forWrite(ctx, projectKey, id);
      await issueTypeIn(sql, projectId, id);
      return { items: await putLayout(sql, id, body.items) };
    },
  };
}

export type IssueTypesService = ReturnType<typeof createIssueTypesService>;
