import type { RequestContext, SqlClient, SqlExecutor } from '@bemmoly/core';
import { ConflictError, NotFoundError, ProviderError } from '@bemmoly/shared';
import type { CreateFieldBody, Field, UpdateFieldBody } from '../../../../shared/issue-types.ts';
import { iso } from '../projects/rows.ts';
import { authorizeScope, resolveScope, writableProjectId } from '../projects/scope.ts';

export interface FieldsServiceDeps {
  database?: SqlClient;
}

export interface FieldRow {
  id: string;
  project_id: string | null;
  origin_id: string | null;
  key: string;
  name: string;
  kind: Field['kind'];
  options: Field['options'];
  filterable: boolean;
  ai_fill: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export const FIELD_COLUMNS = `id, project_id, origin_id, key, name, kind, options, filterable,
  ai_fill, created_at, updated_at`;

export const toField = (row: FieldRow): Field => ({
  id: row.id,
  projectId: row.project_id,
  originId: row.origin_id,
  key: row.key,
  name: row.name,
  kind: row.kind,
  options: row.options,
  filterable: row.filterable,
  aiFill: row.ai_fill,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

export async function fieldsOf(sql: SqlExecutor, projectId: string | null): Promise<FieldRow[]> {
  return sql<FieldRow[]>`
    select ${sql.unsafe(FIELD_COLUMNS)} from fields
    where project_id is not distinct from ${projectId}::uuid
    order by key`;
}

const UNIQUE_VIOLATION = '23505';

/**
 * Custom field definitions, org defaults or one project's copies, with the
 * same scope rules as issue types. Values live in issues.custom_fields; the
 * filterable flag is stored here and indexed with the first importer.
 */
export function createFieldsService(deps: FieldsServiceDeps) {
  const db = (): SqlClient => {
    if (!deps.database) throw new ProviderError('The work module needs the database');
    return deps.database;
  };

  async function forWrite(ctx: RequestContext, projectKey: string | null, id?: string) {
    const sql = db();
    const scope = await resolveScope(sql, 'fields', projectKey);
    await authorizeScope(ctx, scope, true);
    const projectId = writableProjectId(scope, 'fields');
    if (id) {
      const [row] = await sql<{ id: string }[]>`
        select id from fields
        where id = ${id} and project_id is not distinct from ${projectId}::uuid`;
      if (!row) throw new NotFoundError('The field was not found');
    }
    return { sql, projectId };
  }

  return {
    async list(ctx: RequestContext, projectKey: string | null): Promise<{ items: Field[] }> {
      const sql = db();
      const scope = await resolveScope(sql, 'fields', projectKey);
      await authorizeScope(ctx, scope, false);
      return { items: (await fieldsOf(sql, scope.rowsProjectId)).map(toField) };
    },

    async create(
      ctx: RequestContext,
      projectKey: string | null,
      body: CreateFieldBody,
    ): Promise<Field> {
      const { sql, projectId } = await forWrite(ctx, projectKey);
      try {
        const [row] = await sql<FieldRow[]>`
          insert into fields (project_id, key, name, kind, options, filterable, ai_fill)
          values (${projectId}::uuid, ${body.key}, ${body.name}, ${body.kind},
            ${JSON.stringify(body.options ?? [])}::jsonb, ${body.filterable ?? false},
            ${body.aiFill ?? false})
          returning ${sql.unsafe(FIELD_COLUMNS)}`;
        if (!row) throw new ProviderError('The field was not stored');
        return toField(row);
      } catch (error) {
        if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
          throw new ConflictError(`A field with the key ${body.key} already exists`);
        }
        throw error;
      }
    },

    /** Key and kind are fixed after creation: stored values are typed by them. */
    async update(
      ctx: RequestContext,
      projectKey: string | null,
      id: string,
      patch: UpdateFieldBody,
    ): Promise<Field> {
      const { sql } = await forWrite(ctx, projectKey, id);
      const [row] = await sql<FieldRow[]>`
        update fields set
          name = coalesce(${patch.name ?? null}, name),
          options = coalesce(${patch.options ? JSON.stringify(patch.options) : null}::jsonb, options),
          filterable = coalesce(${patch.filterable ?? null}::boolean, filterable),
          ai_fill = coalesce(${patch.aiFill ?? null}::boolean, ai_fill),
          updated_at = now()
        where id = ${id}
        returning ${sql.unsafe(FIELD_COLUMNS)}`;
      if (!row) throw new ProviderError('The field was not updated');
      return toField(row);
    },

    /** Layout rows cascade; values already written stay in issues.custom_fields under the key. */
    async remove(ctx: RequestContext, projectKey: string | null, id: string): Promise<void> {
      const { sql } = await forWrite(ctx, projectKey, id);
      await sql`delete from fields where id = ${id}`;
    },
  };
}

export type FieldsService = ReturnType<typeof createFieldsService>;
