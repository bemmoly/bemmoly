import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Project } from '../../../../shared/projects.ts';
import { allocateNumber } from './create.ts';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';

/*
 * The statements every create runs, checked against a project big enough that a plan which
 * scans the project would show: the tail rank must come off the board index alone.
 */

const SEEDED = 5_000;

interface PlanNode {
  'Node Type': string;
  'Index Name'?: string;
  Plans?: PlanNode[];
}

const nodesOf = (node: PlanNode): PlanNode[] => [node, ...(node.Plans ?? []).flatMap(nodesOf)];

describe('issue create hot paths against Postgres', () => {
  let start: HarnessStart;
  let work: WorkHarness;
  let project: Project;

  beforeAll(async () => {
    start = await startWorkHarness();
    if (!start.available) return;
    work = start.harness;
    project = await work.project('HOT');
    const template = await work.issue(project, 'Template');
    // Copies of the template with their own number, key and rank; a tenth of them deleted.
    await work.sql`
      insert into issues (project_id, number, key, type_id, title, status_id, priority,
        reporter_id, custom_fields, rank, deleted_at)
      select t.project_id, t.number + g, 'HOT-' || (t.number + g), t.type_id, 'Seeded ' || g,
        t.status_id, t.priority, t.reporter_id, '{}'::jsonb,
        'a' || translate(lpad(g::text, 6, '0'), '0123456789', 'bcdefghijk'),
        case when g % 10 = 0 then now() end
      from issues t, generate_series(1, ${SEEDED}) g
      where t.id = ${template.id}`;
    await work.sql`
      update project_counters set next_number = ${SEEDED + 2} where project_id = ${project.id}`;
    await work.sql`analyze issues`;
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  it('reads the tail rank with an index-only scan of issues_board_rank_idx', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const [row] = await work.sql<{ 'QUERY PLAN': { Plan: PlanNode }[] }[]>`
      explain (format json)
      select max(rank) as rank from issues
      where project_id = ${project.id} and deleted_at is null`;
    const nodes = nodesOf(row!['QUERY PLAN'][0]!.Plan);
    expect(nodes.map((node) => node['Node Type'])).not.toContain('Seq Scan');
    expect(nodes).toContainEqual(
      expect.objectContaining({
        'Node Type': 'Index Only Scan',
        'Index Name': 'issues_board_rank_idx',
      }),
    );
  });

  it('appends a new issue after every live one', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const issue = await work.issue(project, 'After the seed');
    const [later] = await work.sql<{ count: number }[]>`
      select count(*)::int as count from issues
      where project_id = ${project.id} and deleted_at is null and rank >= ${issue.rank}
        and id <> ${issue.id}`;
    expect(later?.count).toBe(0);
  });

  it('gives a rolled back number back, so keys stay gap-free', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const fresh = await work.project('GAP');
    await work.issue(fresh, 'One');
    await work.sql
      .begin(async (tx) => {
        expect(await allocateNumber(tx, fresh.id)).toBe(2);
        throw new Error('roll back');
      })
      .catch(() => undefined);
    const two = await work.issue(fresh, 'Two');
    expect(two.key).toBe('GAP-2');
  });

  it('numbers from 1 in a project that has no counter row yet', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const fresh = await work.project('NEW');
    await work.sql`delete from project_counters where project_id = ${fresh.id}`;
    const created = await Promise.all(
      Array.from({ length: 8 }, (_, index) => work.issue(fresh, `Parallel ${index}`)),
    );
    expect(created.map((issue) => issue.number).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  it('moves a restored issue to the end when a new issue took its rank', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const fresh = await work.project('RST');
    const admin = work.as(work.users.admin);
    const first = await work.issue(fresh, 'First');
    const last = await work.issue(fresh, 'Last');
    await work.services.issues.remove(admin, last.key);
    // The tail is read from live issues, so the next create lands on the deleted one's rank.
    const next = await work.issue(fresh, 'Next');
    expect(next.rank).toBe(last.rank);
    const restored = await work.services.issues.restore(admin, last.key);
    expect(restored.rank > next.rank).toBe(true);
    expect(new Set([first.rank, next.rank, restored.rank]).size).toBe(3);
  });
});
