import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Issue } from '../../../../shared/issues.ts';
import type { Project } from '../../../../shared/projects.ts';
import type { Workflow } from '../../../../shared/workflows.ts';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';

/*
 * What the editor reads back: issue counts per status for the people who
 * can see them, the publish time, the canvas layout kept through a publish,
 * and a project copy that takes its project's issues with it.
 */
describe('workflow publish details against Postgres', () => {
  let start: HarnessStart;
  let work: WorkHarness;
  let open: Project;
  let closed: Project;
  let org: Workflow;
  let shared: Issue;

  const admin = () => work.as(work.users.admin);

  beforeAll(async () => {
    start = await startWorkHarness();
    if (!start.available) return;
    work = start.harness;
    open = await work.project('CNTA', [work.users.member]);
    closed = await work.project('CNTB');
    shared = await work.issue(open, 'Visible one');
    await work.issue(open, 'Visible two');
    await work.issue(closed, 'Hidden from the member');
    org = (await work.services.workflow.list(admin())).find((flow) => !flow.projectId)!;
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  it('counts issues per status, every status listed, only where the person can see', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const backlog = shared.statusId;
    const forAdmin = await work.services.workflow.statusCounts(admin(), org.id);
    expect(Object.keys(forAdmin.counts).sort()).toEqual(org.statuses.map((s) => s.id).sort());
    expect(forAdmin.counts[backlog]).toBe(3);
    const forMember = await work.services.workflow.statusCounts(work.as(work.users.member), org.id);
    expect(forMember.counts[backlog]).toBe(2);
    const narrowed = await work.services.workflow.statusCounts(admin(), org.id, closed.id);
    expect(narrowed.counts[backlog]).toBe(1);
    const outsider = await work.services.workflow.statusCounts(
      work.as(work.users.outsider),
      org.id,
    );
    expect(Object.values(outsider.counts).every((count) => count === 0)).toBe(true);
  });

  it('moves a project onto its copy, and only its issues count there', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    await work.services.boards.listForProject(admin(), closed.key);
    const copy = await work.services.workflow.create(admin(), {
      name: 'Closed workflow',
      projectId: closed.id,
    });
    const [issue] = await work.sql<{ status_id: string }[]>`
      select status_id from issues where project_id = ${closed.id}`;
    expect(copy.statuses.map((status) => status.id)).toContain(issue?.status_id);
    const own = await work.services.workflow.statusCounts(admin(), copy.id);
    expect(Object.values(own.counts).reduce((sum, count) => sum + count, 0)).toBe(1);
    const orgCounts = await work.services.workflow.statusCounts(admin(), org.id);
    expect(orgCounts.counts[shared.statusId]).toBe(2);
    const [board] = await work.services.boards.listForProject(admin(), closed.key);
    const mapped = board!.config.columns.flatMap((column) => column.statusIds);
    expect(mapped.every((id) => copy.statuses.some((status) => status.id === id))).toBe(true);
  });

  it('stamps the publish time and keeps where each status was drawn', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    expect(org.publishedAt).toEqual(expect.any(String));
    const draft = await work.services.workflow.getDraft(admin(), org.id);
    const placed = {
      ...draft,
      statuses: draft.statuses.map((status, index) => ({ ...status, x: 120 + index * 150, y: 80 })),
    };
    await work.services.workflow.putDraft(admin(), org.id, placed);
    const before = Date.now();
    const published = await work.services.workflow.publish(admin(), org.id, {});
    expect(published.publishedVersion).toBe(org.publishedVersion + 1);
    expect(new Date(published.publishedAt ?? 0).getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(published.statuses.map((status) => [status.x, status.y])).toEqual(
      placed.statuses.map((_, index) => [120 + index * 150, 80]),
    );
    const reopened = await work.services.workflow.getDraft(admin(), org.id);
    expect(reopened.statuses[0]).toMatchObject({ x: 120, y: 80 });
  });
});
