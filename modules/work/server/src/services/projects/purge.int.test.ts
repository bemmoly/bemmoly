import { NotFoundError } from '@bemmoly/shared';
import { createChangelogRunner, loadKernelChangelog, type SqlClient } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import workModule from '../../../../module.ts';
import type { RichText } from '../../../../shared/common.ts';
import type { Project } from '../../../../shared/projects.ts';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';
import { WORK_PROJECT_PURGE_JOB } from '../jobs.ts';
import { INLINE_ISSUE_LIMIT, purgeIdempotencyKey } from './purge.ts';

const text = (value: string): RichText => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
});

const SHA = 'a'.repeat(64);

/** Everything that points at a project's issues and comments without a foreign key. */
async function seedDependents(sql: SqlClient, projectId: string, userId: string): Promise<void> {
  await sql`
    insert into comments (target_kind, target_id, author_id, body, reactions)
    select 'issue', i.id, ${userId}, '{"type":"doc"}'::jsonb,
      jsonb_build_object('+1', jsonb_build_array(${userId}::text))
    from issues i where i.project_id = ${projectId}`;
  await sql`
    insert into attachments (target_kind, target_id, storage_key, filename, mime, size, sha256)
    select 'issue', i.id, 'k/' || i.id, 'a.txt', 'text/plain', 1, ${SHA}
    from issues i where i.project_id = ${projectId}
    union all
    select 'comment', c.id, 'k/' || c.id, 'c.txt', 'text/plain', 1, ${SHA}
    from comments c join issues i on i.id = c.target_id where i.project_id = ${projectId}`;
  await sql`
    insert into watchers (target_kind, target_id, user_id)
    select 'issue', i.id, ${userId} from issues i where i.project_id = ${projectId}
    on conflict do nothing`;
  await sql`
    insert into notifications (user_id, kind, target_kind, target_id, delivery)
    select ${userId}, 'comment', 'issue', i.id::text, 'inapp'
    from issues i where i.project_id = ${projectId}`;
  await sql`
    insert into pending_embeddings (target_kind, target_id)
    select 'work.issue', i.id::text from issues i where i.project_id = ${projectId}`;
  await sql`
    insert into ai_insights (target_kind, target_id, kind, input_hash)
    select 'issue', i.id, 'summary', 'h' from issues i where i.project_id = ${projectId}`;
}

/** Rows of each table whose issue or comment is gone, the integrity view plus kernel rows. */
async function orphans(sql: SqlClient): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const row of await sql<{ table_name: string; orphans: string }[]>`
    select table_name, orphans from integrity_orphans_work`) {
    counts[row.table_name] = Number(row.orphans);
  }
  const [kernel] = await sql<{ notifications: number; pending: number; insights: number }[]>`
    select
      (select count(*)::int from notifications n where n.target_kind = 'issue'
        and not exists (select 1 from issues i where i.id::text = n.target_id)) as notifications,
      (select count(*)::int from pending_embeddings p where p.target_kind = 'work.issue'
        and not exists (select 1 from issues i where i.id::text = p.target_id)) as pending,
      (select count(*)::int from ai_insights a where a.target_kind = 'issue'
        and not exists (select 1 from issues i where i.id = a.target_id)) as insights`;
  return { ...counts, ...kernel };
}

const NONE = {
  comments: 0,
  attachments: 0,
  watchers: 0,
  notifications: 0,
  pending: 0,
  insights: 0,
};

async function dependentsOf(sql: SqlClient, issueId: string): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    select ((select count(*) from comments where target_id = ${issueId})
      + (select count(*) from watchers where target_id = ${issueId})
      + (select count(*) from notifications where target_id = ${issueId}::text))::int as n`;
  return row?.n ?? 0;
}

describe('deleting a project against Postgres', () => {
  let start: HarnessStart;
  let work: WorkHarness;
  let kept: Project;
  let keptIssueId: string;

  beforeAll(async () => {
    start = await startWorkHarness();
    if (!start.available) return;
    work = start.harness;
    kept = await work.project('KEEP');
    keptIssueId = (await work.issue(kept, 'Stays')).id;
    await seedDependents(work.sql, kept.id, work.users.admin);
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  it('removes comments, reactions, replies and every other dependent with the project', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const admin = work.as(work.users.admin);
    const project = await work.project('GONE');
    const issue = await work.issue(project, 'Has a thread');
    await work.issue(project, 'Another');
    const root = await work.services.comments.create(admin, issue.key, { body: text('Root') });
    await work.services.comments.create(admin, issue.key, {
      body: text('Reply'),
      parentId: root.id,
    });
    await work.services.comments.react(admin, root.id, { reaction: 'tada' });
    await seedDependents(work.sql, project.id, work.users.admin);
    expect(await dependentsOf(work.sql, issue.id)).toBeGreaterThan(0);

    await work.services.projects.archive(admin, project.key);
    await work.services.projects.remove(admin, project.key);

    expect(await orphans(work.sql)).toEqual(NONE);
    expect(await dependentsOf(work.sql, issue.id)).toBe(0);
    expect(work.jobs.filter((job) => job.name === WORK_PROJECT_PURGE_JOB)).toEqual([]);
    expect(await dependentsOf(work.sql, keptIssueId)).toBe(3);
  });

  it('hands a large project to the purge job, which deletes it in batches', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const admin = work.as(work.users.admin);
    const project = await work.project('HUGE');
    const first = await work.issue(project, 'The first of many');
    const total = INLINE_ISSUE_LIMIT + 1;
    await work.sql`
      insert into issues (project_id, number, key, type_id, title, status_id, rank)
      select ${project.id}, n, 'HUGE-' || n, i.type_id, 'Issue ' || n, i.status_id,
        'm' || translate(lpad(n::text, 6, '0'), '0123456789', 'abcdefghij') || 'b'
      from issues i, generate_series(2, ${total}) as n
      where i.id = ${first.id}`;
    await seedDependents(work.sql, project.id, work.users.admin);
    await work.services.projects.archive(admin, project.key);
    await work.services.projects.remove(admin, project.key);

    const sent = work.jobs.filter((job) => job.name === WORK_PROJECT_PURGE_JOB);
    expect(sent).toEqual([{ name: WORK_PROJECT_PURGE_JOB, payload: { projectId: project.id } }]);
    expect(purgeIdempotencyKey(project.id)).toBe(`project-purge:${project.id}`);
    await expect(work.services.projects.get(admin, project.key)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    const listed = await work.services.projects.list(admin, { archived: true, limit: 50 });
    expect(listed.items.map((item) => item.key)).not.toContain('HUGE');
    const [left] = await work.sql<{ n: number }[]>`
      select count(*)::int as n from issues where project_id = ${project.id}`;
    expect(left?.n).toBe(total);

    await work.services.projects.handlePurgeJob(sent[0]?.payload);
    // A retried or duplicated job finds nothing to do.
    await work.services.projects.handlePurgeJob(sent[0]?.payload);

    const [after] = await work.sql<{ issues: number; projects: number }[]>`
      select (select count(*)::int from issues where project_id = ${project.id}) as issues,
        (select count(*)::int from projects where id = ${project.id}) as projects`;
    expect(after).toEqual({ issues: 0, projects: 0 });
    expect(await orphans(work.sql)).toEqual(NONE);
    expect(await dependentsOf(work.sql, keptIssueId)).toBe(3);
  });

  it('leaves a project that was never marked alone when a stray job names it', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    await work.services.projects.handlePurgeJob({ projectId: kept.id });
    const admin = work.as(work.users.admin);
    expect((await work.services.projects.get(admin, kept.key)).id).toBe(kept.id);
    expect(await dependentsOf(work.sql, keptIssueId)).toBe(3);
  });
});

describe('removing orphans left by earlier deletes', () => {
  let start: HarnessStart;
  let work: WorkHarness;

  beforeAll(async () => {
    start = await startWorkHarness();
    if (start.available) work = start.harness;
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  it('deletes them in batches when 0033 runs, after the integrity view counts them', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const project = await work.project('LIVE');
    const live = await work.issue(project, 'Still here');
    await seedDependents(work.sql, project.id, work.users.admin);
    // What a delete without the triggers left: rows whose issue never comes back.
    const ghosts = 12_000;
    await work.sql`
      insert into comments (target_kind, target_id, body)
      select 'issue', uuidv7(), '{"type":"doc"}'::jsonb from generate_series(1, ${ghosts})`;
    await work.sql`
      insert into notifications (user_id, kind, target_kind, target_id, delivery)
      select ${work.users.admin}, 'comment', 'issue', uuidv7()::text, 'inapp'
      from generate_series(1, 10)`;
    expect((await orphans(work.sql)).comments).toBe(ghosts);

    const runner = createChangelogRunner({
      sql: work.sql,
      kernel: await loadKernelChangelog(),
      modules: [{ module: 'work', changelog: workModule.changelog }],
      appVersion: '0.2.0',
    });
    // Back to just before 0033, whatever later changesets there are, then forward again.
    const rolled = await runner.rollback('work', { toId: '0032-work-dependent-cleanup' });
    expect(rolled.map((entry) => entry.id)).toContain('0033-work-remove-orphans');
    await runner.update({ contexts: ['production'] });

    expect(await orphans(work.sql)).toEqual(NONE);
    expect(await dependentsOf(work.sql, live.id)).toBe(3);
  });
});
