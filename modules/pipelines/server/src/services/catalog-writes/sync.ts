import type { SqlExecutor } from '@bemmoly/core';
import type { ApplicationFile } from '../../../../shared/application-yaml.ts';
import type { RepositoryInput } from '../../../../shared/catalog-writes.ts';
import { applicationPathOf, isApplicationFile, readApplicationFile } from './file.ts';
import { findOwner } from './owners.ts';
import { upsertRepository, type RepositoryRecord } from './repositories.ts';
import { storable } from '../runs/templates.ts';
import { refreshSchedules } from '../triggers/schedules.ts';

/*
 * application.yaml on the default branch is an application's source of truth (architecture
 * §9). Each push hands over the files it changed: a new or changed file creates or updates
 * its application, a deleted one archives it, and a file that cannot be applied keeps its
 * error (shown on the repository) until a later push fixes it. An owner that names no team
 * still applies, as No owner, with a warning, since a broken owner must not hide the app.
 */

export interface ApplicationFilesInput {
  repository: Pick<RepositoryInput, 'fullName'> & Partial<RepositoryInput>;
  commitSha: string;
  files: Array<{ path: string; content: string | null }>;
}

export interface ApplicationFilesResult {
  applied: string[];
  archived: string[];
  /** Per file: why it was not applied, or a warning about what was applied. */
  problems: Array<{ path: string; message: string; applied: boolean }>;
}

type Problem = ApplicationFilesResult['problems'][number];

/** "acme/node-service@3", as the catalog stores a template reference. */
function templateOf(file: ApplicationFile): string | null {
  const pipeline = file.pipeline;
  if (!pipeline || !('extends' in pipeline)) return null;
  return `${pipeline.extends.ref}@${pipeline.extends.version}`;
}

async function resolveGroup(sql: SqlExecutor, file: ApplicationFile) {
  const groups = await sql<{ id: string; domain_id: string; domain_key: string }[]>`
    select g.id, g.domain_id, d.key as domain_key
    from pipeline_groups g join pipeline_domains d on d.id = g.domain_id
    where g.key = ${file.group} ${file.domain ? sql`and d.key = ${file.domain}` : sql``}`;
  if (groups.length === 1) return { group: groups[0], error: null };
  if (groups.length === 0) {
    const where = file.domain ? ` in the "${file.domain}" domain` : '';
    return {
      group: null,
      error: `No group called "${file.group}"${where}. Create it in the catalog first.`,
    };
  }
  return {
    group: null,
    error: `"${file.group}" is a group in several domains; add domain: to say which.`,
  };
}

async function applyFile(
  sql: SqlExecutor,
  repository: RepositoryRecord,
  input: ApplicationFilesInput,
  path: string,
  file: ApplicationFile,
  problems: Problem[],
): Promise<string | null> {
  const fail = (message: string) => {
    problems.push({ path, message, applied: false });
    return null;
  };
  const { group, error } = await resolveGroup(sql, file);
  if (!group) return fail(error ?? 'No group');
  const [existing] = await sql<
    { id: string; source: string; repository_id: string | null; file_path: string | null }[]
  >`
    select id, source, repository_id, file_path from pipeline_applications where key = ${file.name}`;
  if (
    existing?.source === 'repository' &&
    (existing.repository_id !== repository.id || existing.file_path !== path)
  ) {
    return fail(
      `${file.name} is already defined by another application.yaml; application names are unique.`,
    );
  }
  const owner = file.owner ? await findOwner(sql, file.owner) : null;
  if (file.owner && !owner) {
    problems.push({
      path,
      message: `No team matches ${file.owner}; ${file.name} has no owner until it does.`,
      applied: true,
    });
  }
  const values = {
    description: file.description ?? null,
    owner: owner?.id ?? null,
    labels: file.labels,
    path: applicationPathOf(path),
    template: templateOf(file),
  };
  const [row] = await sql<{ id: string }[]>`
    insert into pipeline_applications
      (key, name, description, domain_id, group_id, owner_team_id, tier, labels, lifecycle,
       runtime, repository_id, path, paths, template_ref, source, file_path, source_commit_sha,
       pipeline, pipeline_source, pipeline_commit_sha, file_runtimes)
    values (${file.name}, ${file.name}, ${values.description}, ${group.domain_id}::uuid,
      ${group.id}::uuid, ${values.owner}::uuid, ${file.tier}, ${values.labels}::text[],
      ${file.lifecycle}, ${file.runtime ?? 'container-service'}, ${repository.id}::uuid,
      ${values.path}, ${file.paths}::text[], ${values.template}, 'repository', ${path},
      ${input.commitSha}, ${file.pipeline ? JSON.stringify(storable(file.pipeline)) : null}::jsonb,
      ${file.pipeline ? 'repository' : null}, ${file.pipeline ? input.commitSha : null},
      ${JSON.stringify(file.runtimes ?? {})}::jsonb)
    on conflict (key) do update set
      description = excluded.description, domain_id = excluded.domain_id,
      group_id = excluded.group_id, owner_team_id = excluded.owner_team_id, tier = excluded.tier,
      labels = excluded.labels, lifecycle = excluded.lifecycle,
      runtime = ${file.runtime ? sql`excluded.runtime` : sql`pipeline_applications.runtime`},
      repository_id = excluded.repository_id, path = excluded.path, paths = excluded.paths,
      template_ref = excluded.template_ref, source = 'repository', file_path = excluded.file_path,
      source_commit_sha = excluded.source_commit_sha, pipeline = excluded.pipeline,
      pipeline_source = excluded.pipeline_source,
      pipeline_commit_sha = excluded.pipeline_commit_sha, file_runtimes = excluded.file_runtimes,
      archived_at = null, updated_at = now()
    returning id`;
  // The pipeline's schedules follow its definition.
  if (row) await refreshSchedules(sql, row.id);
  await sql`delete from pipeline_catalog_file_errors
    where repository_id = ${repository.id}::uuid and path = ${path}`;
  return row?.id ?? null;
}

async function recordProblems(
  sql: SqlExecutor,
  repositoryId: string,
  commitSha: string,
  problems: readonly Problem[],
) {
  for (const problem of problems) {
    await sql`
      insert into pipeline_catalog_file_errors (repository_id, path, commit_sha, message)
      values (${repositoryId}::uuid, ${problem.path}, ${commitSha}, ${problem.message})
      on conflict (repository_id, path) do update set
        commit_sha = excluded.commit_sha, message = excluded.message, updated_at = now()`;
  }
}

/** Declared dependencies, after every file of the push is in, so order within a push never matters. */
async function applyDependencies(
  sql: SqlExecutor,
  applied: ReadonlyArray<{ id: string; path: string; file: ApplicationFile }>,
  problems: Problem[],
) {
  for (const { id, path, file } of applied) {
    const rows = await sql<{ id: string; key: string }[]>`
      select id, key from pipeline_applications
      where key = any(${file.dependsOn}::text[]) and id <> ${id}::uuid`;
    const missing = file.dependsOn.filter((key) => !rows.some((row) => row.key === key));
    if (missing.length > 0) {
      problems.push({
        path,
        message: `dependsOn names unknown applications: ${missing.join(', ')}`,
        applied: true,
      });
    }
    const ids = rows.map((row) => row.id);
    await sql`delete from pipeline_application_dependencies
      where application_id = ${id}::uuid and source = 'declared' and not (depends_on_id = any(${ids}::uuid[]))`;
    if (ids.length > 0) {
      await sql`
        insert into pipeline_application_dependencies (application_id, depends_on_id, source)
        select ${id}::uuid, unnest(${ids}::uuid[]), 'declared'
        on conflict (application_id, depends_on_id) do update set source = 'declared', updated_at = now()`;
    }
  }
}

export async function syncApplicationFiles(
  sql: SqlExecutor,
  input: ApplicationFilesInput,
): Promise<ApplicationFilesResult & { domains: string[] }> {
  const repository = await upsertRepository(sql, input.repository);
  const problems: Problem[] = [];
  const applied: Array<{
    id: string;
    key: string;
    path: string;
    file: ApplicationFile;
    content: string;
  }> = [];
  const archived: string[] = [];
  for (const { path, content } of input.files.filter((f) => isApplicationFile(f.path))) {
    if (content === null) {
      const rows = await sql<{ key: string }[]>`
        update pipeline_applications set archived_at = now(), updated_at = now()
        where repository_id = ${repository.id}::uuid and file_path = ${path}
          and source = 'repository' and archived_at is null
        returning key`;
      archived.push(...rows.map((row) => row.key));
      await sql`update pipeline_catalog_changes set state = 'applied', updated_at = now()
        where kind = 'archive' and state = 'pending' and repository_id = ${repository.id}::uuid
          and file_path = ${path}`;
      await sql`delete from pipeline_catalog_file_errors
        where repository_id = ${repository.id}::uuid and path = ${path}`;
      continue;
    }
    const read = readApplicationFile(content);
    if (!read.ok) {
      problems.push({ path, message: read.error, applied: false });
      continue;
    }
    const id = await applyFile(sql, repository, input, path, read.file, problems);
    if (id) applied.push({ id, key: read.file.name, path, file: read.file, content });
  }
  await applyDependencies(sql, applied, problems);
  await recordProblems(sql, repository.id, input.commitSha, problems);
  for (const item of applied) {
    // The pull request a UI edit opened has landed: its change is applied.
    await sql`update pipeline_catalog_changes set state = 'applied', updated_at = now()
      where application_id = ${item.id}::uuid and state in ('pull_request', 'pending')
        and kind <> 'archive' and file_content = ${item.content}`;
  }
  const keys = applied.map((item) => item.key);
  const domains = await sql<{ key: string }[]>`
    select distinct d.key from pipeline_applications a join pipeline_domains d on d.id = a.domain_id
    where a.key = any(${[...keys, ...archived]}::text[])`;
  return { applied: keys, archived, problems, domains: domains.map((d) => d.key) };
}
