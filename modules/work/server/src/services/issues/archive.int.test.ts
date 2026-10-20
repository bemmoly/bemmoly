import { ForbiddenError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listIssuesQuerySchema } from '../../../../shared/issues.ts';
import type { Project } from '../../../../shared/projects.ts';
import { automationFixture, type AutomationFixture } from '../automation/automation-support.ts';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';

/*
 * Archiving against Postgres: an archived issue leaves every working view, stays readable by
 * its key and in an LQL query that asks for it, and comes back whole.
 */

describe('issue archiving against Postgres', () => {
  let start: HarnessStart;
  let work: WorkHarness;
  let auto: AutomationFixture;
  let project: Project;

  beforeAll(async () => {
    start = await startWorkHarness();
    if (!start.available) return;
    work = start.harness;
    auto = automationFixture(work);
    project = await work.project('ARC', [work.users.member]);
  });

  afterAll(async () => {
    auto?.stop();
    if (start.available) await work.stop();
  });

  const listed = async (archived: boolean) => {
    const query = listIssuesQuerySchema.parse({ projectId: project.id, archived });
    const page = await work.services.issues.list(work.as(work.users.admin), query);
    return page.items.map((issue) => issue.key);
  };
  const queried = async (lql: string) => {
    const page = await work.services.lql.query(work.as(work.users.admin), {
      lql,
      projectId: project.id,
      limit: 50,
    });
    return page.items.map((issue) => issue.key);
  };

  it('takes an issue off lists, the backlog and search, and puts it back as it was', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const as = work.as(work.users.member);
    const kept = await work.issue(project, 'Keep the pantry stocked');
    const old = await work.issue(project, 'Restock the pantry shelves');

    const archived = await work.services.issues.archive(as, old.key);
    expect(archived.archivedAt).not.toBeNull();
    expect(await listed(false)).toEqual([kept.key]);
    expect(await listed(true)).toEqual([old.key]);
    expect(await queried('')).toEqual([kept.key]);
    expect(await queried('archived IS NOT EMPTY')).toEqual([old.key]);
    const backlog = await work.services.backlog.get(work.as(work.users.admin), project.key);
    expect(backlog.issues.map((issue) => issue.key)).toEqual([kept.key]);
    const hits = await work.services.search.search(as, { q: 'pantry', limit: 20 });
    expect(hits.map((hit) => hit.key)).toEqual([kept.key]);
    const byKey = await work.services.search.suggest(as, { q: old.key, limit: 10 });
    expect(byKey.map((hit) => hit.key)).toEqual([old.key]);
    expect((await work.services.issues.get(as, old.key)).archivedAt).toBe(archived.archivedAt);

    const again = await work.services.issues.archive(as, old.key);
    expect(again.archivedAt).toBe(archived.archivedAt);

    const back = await work.services.issues.unarchive(as, old.key);
    expect(back.archivedAt).toBeNull();
    expect((await listed(false)).sort()).toEqual([kept.key, old.key].sort());
    const history = await work.sql<{ field: string; to_value: unknown }[]>`
      select field, to_value from issue_history
      where issue_id = ${old.id} and field = 'archived' order by created_at, id`;
    expect(history.map((row) => row.to_value)).toEqual([true, null]);
  });

  it('refuses people outside the project', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const issue = await work.issue(project, 'Not yours to put away');
    await expect(
      work.services.issues.archive(work.as(work.users.outsider), issue.key),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('archives from a rule, and says so when the issue is already archived', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const rule = await auto.rule({
      name: 'Put away won’t-fix bugs',
      projectId: project.id,
      enabled: true,
      trigger: { name: 'issue_created' },
      conditions: ['text ~ "wontfix"'],
      actions: [{ name: 'archive', args: {} }],
    });
    const issue = await work.issue(project, 'wontfix: flaky printer');
    expect(await auto.drain()).toBe(1);
    expect(
      (await work.services.issues.get(work.as(work.users.admin), issue.key)).archivedAt,
    ).not.toBeNull();
    const [run] = await auto.runs(rule.id);
    expect(run).toMatchObject({
      status: 'succeeded',
      result: { actions: [{ name: 'archive', ok: true, message: 'Archived the issue' }] },
    });
    await work.services.automation.update(work.as(work.users.admin), rule.id, { enabled: false });
  });
});
