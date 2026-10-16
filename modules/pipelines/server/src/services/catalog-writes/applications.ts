import type { RequestContext, SqlClient } from '@bemmoly/core';
import { ConflictError } from '@bemmoly/shared';
import type {
  ApplicationWriteResult,
  CreateApplicationBody,
  UpdateApplicationBody,
} from '../../../../shared/catalog-writes.ts';
import type { WritableApplicationRow } from '../../models/catalog-writes.ts';
import type { AccessEngine } from '../access/index.ts';
import type { CatalogService } from '../catalog/index.ts';
import { personOf, requirePerson } from '../deps.ts';
import { applicationFilePath, writeApplicationFile } from './file.ts';
import {
  applicationByKey,
  dependencyIds,
  groupByPath,
  publishCatalog,
  writeDependencies,
} from './lookups.ts';
import { ownerRefOf, resolveOwner } from './owners.ts';
import { openRepositoryChange, readChange, summarise, type ChangePorts } from './repo-change.ts';
import { upsertRepository } from './repositories.ts';

/*
 * Creating, changing and archiving applications from the UI. An application whose
 * application.yaml is its truth changes through a pull request for the fields that file
 * holds; the rest (its display name, CI and promotion mode) change at once.
 */

/** The fields application.yaml holds, as the body names them. */
const FILE_FIELDS = [
  'group',
  'owner',
  'tier',
  'labels',
  'lifecycle',
  'runtime',
  'description',
  'dependsOn',
  'paths',
] as const;

/** Archive, never delete, an application anything has happened to. */
async function hasHistory(sql: SqlClient, id: string): Promise<boolean> {
  const [row] = await sql<{ used: boolean }[]>`
    select exists (select 1 from pipeline_run_applications where application_id = ${id}::uuid)
      or exists (select 1 from pipeline_releases where application_id = ${id}::uuid)
      or exists (select 1 from pipeline_deployments where application_id = ${id}::uuid) as used`;
  return row?.used ?? true;
}

export function createApplicationWrites(
  sql: () => SqlClient,
  access: AccessEngine,
  catalog: CatalogService,
  ports: ChangePorts,
) {
  async function result(
    ctx: RequestContext,
    key: string,
    row: WritableApplicationRow,
    changeId: string | null,
  ): Promise<ApplicationWriteResult> {
    return {
      application: await catalog.application(ctx, key),
      source: row.source,
      change: changeId ? await readChange(sql(), changeId) : null,
    };
  }

  /** Validates the file fields and turns them into application.yaml's words. */
  async function fileFieldsOf(row: WritableApplicationRow | null, body: UpdateApplicationBody) {
    const db = sql();
    const group = body.group ? await groupByPath(db, body.group) : null;
    const owner = body.owner === undefined ? undefined : await resolveOwner(db, body.owner);
    if (body.dependsOn && row) await dependencyIds(db, row.key, body.dependsOn);
    const fields: Record<string, unknown> = {};
    if (group) Object.assign(fields, { group: group.key, domain: group.domain_key });
    if (owner !== undefined) fields.owner = owner ? ownerRefOf(owner) : null;
    for (const name of [
      'tier',
      'labels',
      'lifecycle',
      'runtime',
      'description',
      'dependsOn',
      'paths',
    ] as const) {
      if (body[name] !== undefined) fields[name] = body[name];
    }
    return { fields, group, owner };
  }

  return {
    async create(
      ctx: RequestContext,
      body: CreateApplicationBody,
    ): Promise<ApplicationWriteResult> {
      const db = sql();
      const group = await groupByPath(db, body.group);
      await access.authorizeAction(ctx, 'manage', { scope: { kind: 'group', id: group.id } });
      const owner = await resolveOwner(db, body.owner);
      const dependencies = await dependencyIds(db, body.key, body.dependsOn);
      const { id, repository } = await db.begin(async (tx) => {
        const repository = body.repository ? await upsertRepository(tx, body.repository) : null;
        const [row] = await tx<{ id: string }[]>`
          insert into pipeline_applications
            (key, name, description, domain_id, group_id, owner_team_id, tier, labels, runtime,
             lifecycle, ci_mode, promotion_mode, repository_id, path, paths)
          values (${body.key}, ${body.name}, ${body.description ?? null}, ${group.domain_id}::uuid,
            ${group.id}::uuid, ${owner?.id ?? null}::uuid, ${body.tier}, ${body.labels}::text[],
            ${body.runtime}, ${body.lifecycle}, ${body.ciMode}, ${body.promotionMode},
            ${repository?.id ?? null}::uuid, ${body.path}, ${body.paths}::text[])
          on conflict (key) do nothing returning id`;
        if (!row) throw new ConflictError(`An application called "${body.key}" already exists`);
        await writeDependencies(tx, row.id, dependencies);
        await publishCatalog(tx, [body.key], group.domain_key);
        return { id: row.id, repository };
      });
      let changeId: string | null = null;
      const repo = repository;
      if (repo) {
        // The catalog entry exists now; the pull request makes the repository its source.
        changeId = await openRepositoryChange(db, ports, {
          kind: 'create',
          applicationId: id,
          applicationKey: body.key,
          repository: { id: repo.id, fullName: repo.full_name, defaultBranch: repo.default_branch },
          filePath: applicationFilePath(body.path),
          fields: {},
          content: writeApplicationFile({
            name: body.key,
            group: group.key,
            domain: group.domain_key,
            ...(owner ? { owner: ownerRefOf(owner) } : {}),
            tier: body.tier,
            labels: body.labels,
            lifecycle: body.lifecycle,
            runtime: body.runtime,
            ...(body.description ? { description: body.description } : {}),
            dependsOn: body.dependsOn,
            paths: body.paths,
          }),
          summary: `Adds ${body.key} to the catalog`,
          createdBy: personOf(ctx.actor),
        });
      }
      return result(ctx, body.key, await applicationByKey(db, body.key), changeId);
    },

    async update(
      ctx: RequestContext,
      key: string,
      body: UpdateApplicationBody,
    ): Promise<ApplicationWriteResult> {
      const db = sql();
      const row = await applicationByKey(db, key);
      await access.authorizeAction(ctx, 'manage', { application: row.id });
      const { fields, group, owner } = await fileFieldsOf(row, body);
      if (group && group.id !== row.group_id) {
        await access.authorizeAction(ctx, 'manage', { scope: { kind: 'group', id: group.id } });
      }
      const touched = FILE_FIELDS.filter((name) => body[name] !== undefined);
      const fromFile = row.source === 'repository' && row.repository_full_name && row.file_path;
      await db.begin(async (tx) => {
        await tx`
          update pipeline_applications set
            name = coalesce(${body.name ?? null}, name),
            ci_mode = coalesce(${body.ciMode ?? null}, ci_mode),
            promotion_mode = coalesce(${body.promotionMode ?? null}, promotion_mode),
            updated_at = now()
          where id = ${row.id}::uuid`;
        if (!fromFile) {
          await tx`
            update pipeline_applications set
              group_id = coalesce(${group?.id ?? null}::uuid, group_id),
              domain_id = coalesce(${group?.domain_id ?? null}::uuid, domain_id),
              owner_team_id = ${owner === undefined ? tx`owner_team_id` : tx`${owner?.id ?? null}::uuid`},
              tier = coalesce(${body.tier ?? null}, tier),
              labels = coalesce(${body.labels ?? null}::text[], labels),
              lifecycle = coalesce(${body.lifecycle ?? null}, lifecycle),
              runtime = coalesce(${body.runtime ?? null}, runtime),
              description = ${body.description === undefined ? tx`description` : body.description},
              paths = coalesce(${body.paths ?? null}::text[], paths),
              updated_at = now()
            where id = ${row.id}::uuid`;
          if (body.dependsOn)
            await writeDependencies(tx, row.id, await dependencyIds(tx, key, body.dependsOn));
        }
        await publishCatalog(tx, [key], group?.domain_key ?? row.domain_key);
      });
      let changeId: string | null = null;
      if (fromFile && touched.length > 0 && row.repository_full_name && row.file_path) {
        changeId = await openRepositoryChange(db, ports, {
          kind: 'update',
          applicationId: row.id,
          applicationKey: key,
          repository: {
            id: row.repository_id,
            fullName: row.repository_full_name,
            defaultBranch: row.repository_default_branch ?? 'main',
          },
          filePath: row.file_path,
          fields,
          summary: summarise(touched),
          createdBy: requirePerson(ctx.actor),
        });
      }
      return result(ctx, key, row, changeId);
    },

    async setDependencies(ctx: RequestContext, key: string, dependsOn: string[]) {
      return this.update(ctx, key, { dependsOn });
    },

    /** Archives an application with history, deletes one without; a file-backed one waits on its file. */
    async remove(ctx: RequestContext, key: string): Promise<{ change: string | null }> {
      const db = sql();
      const row = await applicationByKey(db, key);
      await access.authorizeAction(ctx, 'manage', { application: row.id });
      if (row.source === 'repository' && row.repository_full_name && row.file_path) {
        const [change] = await db<{ id: string }[]>`
          insert into pipeline_catalog_changes
            (application_id, repository_id, kind, state, summary, file_path, reason, created_by)
          values (${row.id}::uuid, ${row.repository_id}::uuid, 'archive', 'pending',
            ${`Removes ${key} from the catalog`}, ${row.file_path},
            ${`Delete ${row.file_path} in ${row.repository_full_name}; the next push to ${row.repository_default_branch ?? 'main'} archives ${key}.`},
            ${requirePerson(ctx.actor)}::uuid)
          returning id`;
        return { change: change?.id ?? null };
      }
      const keep = await hasHistory(db, row.id);
      await db.begin(async (tx) => {
        if (keep) {
          await tx`update pipeline_applications set archived_at = now(), updated_at = now()
            where id = ${row.id}::uuid and archived_at is null`;
        } else {
          await tx`delete from pipeline_applications where id = ${row.id}::uuid`;
        }
        await publishCatalog(tx, [key], row.domain_key);
      });
      return { change: null };
    },
  };
}

export type ApplicationWrites = ReturnType<typeof createApplicationWrites>;
