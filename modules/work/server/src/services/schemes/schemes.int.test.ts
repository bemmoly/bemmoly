import { ConflictError, ForbiddenError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Issue } from '../../../../shared/issues.ts';
import type { Project } from '../../../../shared/projects.ts';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';

describe('project schemes against Postgres', () => {
  let start: HarnessStart;
  let work: WorkHarness;
  let project: Project;
  let issue: Issue;

  const admin = () => work.as(work.users.admin);
  const status = async (kind: string) =>
    (await work.services.schemes.list(admin(), project.id)).items.find((row) => row.kind === kind);
  const issueRow = async () =>
    (
      await work.sql<{ type_id: string; status_id: string }[]>`
        select type_id, status_id from issues where id = ${issue.id}`
    )[0]!;

  beforeAll(async () => {
    start = await startWorkHarness();
    if (!start.available) return;
    work = start.harness;
    project = await work.project('SCHM', [work.users.member]);
    issue = await work.issue(project, 'Follows its scheme');
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  it('starts with every scheme inherited', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const { items } = await work.services.schemes.list(work.as(work.users.member), project.key);
    expect(items.map((row) => [row.kind, row.overridden, row.overrideCount])).toEqual([
      ['issue_types', false, 0],
      ['fields', false, 0],
      ['workflow', false, 0],
      ['board', false, 0],
    ]);
    expect(items.find((row) => row.kind === 'workflow')?.originName).toBe('Default');
  });

  it('lets only someone who configures the project override or reset', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    await expect(
      work.services.schemes.override(work.as(work.users.member), project.key, 'issue_types'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      work.services.schemes.list(work.as(work.users.outsider), project.key),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('copies issue types, moves issues onto them, diffs an edit and resets', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const orgType = (await issueRow()).type_id;
    await work.services.schemes.override(admin(), project.id, 'issue_types');
    const { items: types } = await work.services.types.list(admin(), project.key);
    const copy = types.find((type) => type.originId === orgType)!;
    expect((await issueRow()).type_id).toBe(copy.id);
    const layouts = await work.sql<{ project: boolean; count: number }[]>`
      select t.project_id is not null as project, count(*)::int as count
      from issue_type_fields l join issue_types t on t.id = l.issue_type_id
      group by 1 order by 1`;
    expect(layouts[0]?.count).toBeGreaterThan(0);
    expect(layouts[1]?.count).toBe(layouts[0]?.count);
    await work.services.types.update(admin(), null, copy.id, { name: 'Chore' });
    const diff = await work.services.schemes.diff(admin(), project.key, 'issue_types');
    expect(diff.entries).toMatchObject([{ key: 'task', change: 'changed', attributes: ['name'] }]);
    expect(diff.mark?.overriddenBy).toBe(work.users.admin);
    expect(await status('issue_types')).toMatchObject({ overridden: true, overrideCount: 1 });
    await work.services.schemes.reset(admin(), project.key, 'issue_types');
    expect((await issueRow()).type_id).toBe(orgType);
    expect(await status('issue_types')).toMatchObject({ overridden: false, overrideCount: 0 });
    const [{ count } = { count: -1 }] = await work.sql<{ count: number }[]>`
      select count(*)::int as count from issue_types where project_id = ${project.id}`;
    expect(count).toBe(0);
  });

  it('refuses edits to fields until they are overridden, then diffs an added one', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const body = { key: 'customer', name: 'Customer', kind: 'text' as const };
    await expect(work.services.fields.create(admin(), project.key, body)).rejects.toBeInstanceOf(
      ConflictError,
    );
    await work.services.schemes.override(admin(), project.key, 'fields');
    await work.services.fields.create(admin(), project.key, body);
    const diff = await work.services.schemes.diff(admin(), project.key, 'fields');
    expect(diff.entries.map((entry) => [entry.key, entry.change])).toEqual([['customer', 'added']]);
    await work.services.schemes.reset(admin(), project.key, 'fields');
    const { items } = await work.services.fields.list(admin(), project.key);
    expect(items.every((field) => field.projectId === null)).toBe(true);
  });

  it('copies the workflow with the project issues and puts them back by name', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const orgStatus = (await issueRow()).status_id;
    await work.services.schemes.override(admin(), project.key, 'workflow');
    const flows = await work.services.workflow.list(admin(), project.id);
    const own = flows.find((flow) => flow.projectId === project.id)!;
    expect(own.statuses.map((row) => row.id)).toContain((await issueRow()).status_id);
    expect(await status('workflow')).toMatchObject({ overridden: true, overrideCount: 0 });
    await work.services.schemes.reset(admin(), project.key, 'workflow');
    expect((await issueRow()).status_id).toBe(orgStatus);
    expect(await status('workflow')).toMatchObject({ overridden: false });
  });

  it('counts board changes and puts the org default board back on reset', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const [board] = await work.services.boards.listForProject(admin(), project.key);
    const columns = board!.config.columns.map((column, index) =>
      index === 0 ? { ...column, wipLimit: 3 } : column,
    );
    await work.services.boards.update(admin(), board!.id, {
      config: { ...board!.config, columns },
    });
    const diff = await work.services.schemes.diff(admin(), project.key, 'board');
    expect(diff.entries).toMatchObject([
      { key: 'columns.0.wipLimit', change: 'changed', after: 3 },
    ]);
    expect(await status('board')).toMatchObject({ overridden: true, overrideCount: 1 });
    await work.services.schemes.reset(admin(), project.key, 'board');
    expect(await status('board')).toMatchObject({ overridden: false, overrideCount: 0 });
  });
});
