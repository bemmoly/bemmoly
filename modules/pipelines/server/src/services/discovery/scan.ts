import type { SqlClient, SqlExecutor } from '@bemmoly/core';
import type { RepositoryInput } from '../../../../shared/catalog-writes.ts';
import { findOwner } from '../catalog-writes/owners.ts';
import { upsertRepository } from '../catalog-writes/repositories.ts';
import type { RepositoryTree } from '../code/repository-reader.ts';
import { detectApplications, type DetectedApplication } from './detect.ts';

/*
 * One repository's scan: detect, then keep one proposal per folder. A proposal a person
 * accepted or dismissed is never brought back; one still proposed follows the repository
 * (updated, or removed when its folder no longer holds a deployable).
 */

export interface ScanResult {
  repository: string;
  proposed: number;
  removed: number;
}

/** "@acme/payments", "group:payments", "payments" → team/payments, if such a team exists. */
async function ownerTeam(sql: SqlExecutor, app: DetectedApplication) {
  if (!app.owner) return null;
  const last = app.owner.raw.split(/[/:]/).at(-1) ?? '';
  const slug = last
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? findOwner(sql, `team/${slug}`) : null;
}

/** A Backstage system that names exactly one group becomes the proposal's group. */
async function groupPath(sql: SqlExecutor, system: string | null): Promise<string | null> {
  if (!system) return null;
  const rows = await sql<{ path: string }[]>`
    select d.key || '/' || g.key as path
    from pipeline_groups g join pipeline_domains d on d.id = g.domain_id
    where g.key = ${system.replace(/^system:/, '').toLowerCase()} limit 2`;
  return rows.length === 1 ? (rows[0]?.path ?? null) : null;
}

export async function scanRepository(
  sql: SqlClient,
  repository: Pick<RepositoryInput, 'fullName'> & Partial<RepositoryInput>,
  tree: RepositoryTree,
): Promise<ScanResult> {
  const found = await detectApplications(tree, repository.fullName);
  return sql.begin(async (tx) => {
    const repo = await upsertRepository(tx, repository);
    // What the catalog already holds from this repository is not proposed again.
    const known = await tx<{ path: string }[]>`
      select path from pipeline_applications where repository_id = ${repo.id}::uuid`;
    const detected = found.filter((app) => !known.some((row) => row.path === app.path));
    for (const app of detected) {
      const team = await ownerTeam(tx, app);
      await tx`
        insert into pipeline_discovery_proposals
          (repository_id, path, key, name, description, signals, runtime, owner_raw,
           owner_source, owner_team_id, group_path, commit_sha)
        values (${repo.id}::uuid, ${app.path}, ${app.key}, ${app.name}, ${app.description},
          ${app.signals}::text[], ${app.runtime}, ${app.owner?.raw ?? null},
          ${app.owner?.source ?? null}, ${team?.id ?? null}::uuid,
          ${await groupPath(tx, app.system)}, ${tree.commitSha})
        on conflict (repository_id, path) do update set
          key = excluded.key, name = excluded.name, description = excluded.description,
          signals = excluded.signals, runtime = excluded.runtime, owner_raw = excluded.owner_raw,
          owner_source = excluded.owner_source, owner_team_id = excluded.owner_team_id,
          group_path = excluded.group_path, commit_sha = excluded.commit_sha, updated_at = now()
        where pipeline_discovery_proposals.state = 'proposed'`;
    }
    const paths = detected.map((app) => app.path);
    const removed = await tx`
      delete from pipeline_discovery_proposals
      where repository_id = ${repo.id}::uuid and state = 'proposed'
        and not (path = any(${paths}::text[]))`;
    await tx`update pipeline_repositories
      set discovered_at = now(), discovery_error = null, updated_at = now()
      where id = ${repo.id}::uuid`;
    return { repository: repo.full_name, proposed: detected.length, removed: removed.count };
  });
}
