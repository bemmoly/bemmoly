import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Project } from '../../../../shared/projects.ts';
import { startWorkHarness, type WorkHarness } from '../int-support.ts';

describe("an epic's owner against Postgres", () => {
  let h: WorkHarness;
  let skip = '';
  let n = 0;
  let epicType = '';

  beforeAll(async () => {
    const started = await startWorkHarness();
    if (!started.available) {
      skip = started.reason;
      return;
    }
    h = started.harness;
    const [row] = await h.sql<{ id: string }[]>`
      select id from issue_types where project_id is null and level = 'epic' limit 1`;
    epicType = row!.id;
  });
  afterAll(async () => h?.stop());

  async function setUp(owner: string) {
    const project: Project = await h.project(`EO${(n += 1)}`, [h.users.member]);
    const epic = await h.issue(project, 'Billing', {
      typeId: epicType,
      customFields: { owner, target_date: '2026-12-31' },
    });
    return { project, epic };
  }

  const read = (key: string) => h.services.issues.get(h.as(h.users.admin), key);

  it('assigns an issue created in the epic to its owner', async (ctx) => {
    if (skip) return ctx.skip(skip);
    const { project, epic } = await setUp(h.users.member);
    const issue = await h.issue(project, 'Invoices', { parentId: epic.id });
    expect(issue.assigneeId).toBe(h.users.member);
    expect((await read(issue.key)).assignees.map((person) => person.id)).toEqual([h.users.member]);
  });

  it('assigns an issue moved into the epic, and leaves one somebody is on', async (ctx) => {
    if (skip) return ctx.skip(skip);
    const { project, epic } = await setUp(h.users.member);
    const loose = await h.issue(project, 'Refunds');
    const moved = await h.services.issues.update(h.as(h.users.admin), loose.key, {
      parentId: epic.id,
    });
    expect(moved.assigneeId).toBe(h.users.member);
    const taken = await h.issue(project, 'Tax', { assigneeId: h.users.admin });
    const kept = await h.services.issues.update(h.as(h.users.admin), taken.key, {
      parentId: epic.id,
    });
    expect(kept.assigneeId).toBe(h.users.admin);
    const history = await h.sql<{ field: string }[]>`
      select field from issue_history where issue_id = ${loose.id} order by id`;
    expect(history.map((row) => row.field)).toContain('assigneeId');
  });

  it('keeps an assignee named in the same request, and does nothing without an owner', async (ctx) => {
    if (skip) return ctx.skip(skip);
    const { project, epic } = await setUp(h.users.member);
    const named = await h.issue(project, 'Named', { parentId: epic.id, assigneeId: h.users.admin });
    expect(named.assigneeId).toBe(h.users.admin);
    const ownerless = await setUp(h.users.member);
    await h.services.issues.update(h.as(h.users.admin), ownerless.epic.key, {
      customFields: { owner: null },
    });
    const plain = await h.issue(ownerless.project, 'Plain', { parentId: ownerless.epic.id });
    expect(plain.assigneeId).toBeNull();
  });
});
