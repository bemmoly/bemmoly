import { ForbiddenError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Board, BoardConfig } from '../../../../shared/boards.ts';
import type { Project } from '../../../../shared/projects.ts';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';

/*
 * Settings › Work: the org defaults every project inherits until it overrides them. Only a
 * workspace admin changes them, whatever capability a project admin holds; a change reaches
 * every project still following the default and none that runs its own version.
 */

describe('org defaults against Postgres', () => {
  let start: HarnessStart;
  let work: WorkHarness;
  /** Follows every org default. */
  let follows: Project;
  /** Runs its own board, issue types and fields. */
  let own: Project;
  let orgBoard: Board;
  const people = { workspaceProjectAdmin: '', projectAdmin: '' };

  const admin = () => work.as(work.users.admin);
  const boardOf = async (project: Project) =>
    (await work.services.boards.listForProject(admin(), project.key))[0]!;
  const withFilter = (config: BoardConfig, name: string): BoardConfig => ({
    ...config,
    quickFilters: [...config.quickFilters, { name, query: 'priority = high' }],
  });

  beforeAll(async () => {
    start = await startWorkHarness();
    if (!start.available) return;
    work = start.harness;
    const [workspaceProjectAdmin] = await work.sql<{ id: string }[]>`
      insert into users (email, name, role_id)
      select 'paula@example.test', 'Paula', id from roles where key = 'project_admin'
      returning id`;
    const [projectAdmin] = await work.sql<{ id: string }[]>`
      insert into users (email, name, role_id)
      select 'pia@example.test', 'Pia', id from roles where key = 'member'
      returning id`;
    people.workspaceProjectAdmin = workspaceProjectAdmin!.id;
    people.projectAdmin = projectAdmin!.id;
    follows = await work.project('FLW', [work.users.member]);
    own = await work.project('OWN', [work.users.member]);
    await work.sql`
      insert into project_members (project_id, user_id, role_id)
      select ${follows.id}, ${people.projectAdmin}, id from roles where key = 'project_admin'`;
    await boardOf(follows);
    await boardOf(own);
    await work.services.schemes.override(admin(), own.key, 'board');
    await work.services.schemes.override(admin(), own.key, 'issue_types');
    [orgBoard] = (await work.services.boards.list(admin(), undefined)) as [Board];
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  it('has one org default board, seeded from the default workflow', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    expect(orgBoard).toMatchObject({ projectId: null, name: 'Workspace board' });
    expect(orgBoard.config.columns.map((column) => column.name)).toEqual([
      'Backlog',
      'Selected',
      'In progress',
      'Code review',
      'Testing',
      'Done',
    ]);
    const again = await work.services.boards.list(work.as(work.users.member), undefined);
    expect(again.map((board) => board.id)).toEqual([orgBoard.id]);
  });

  it('refuses every change to the org defaults to anyone but a workspace admin', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const [workflow] = await work.services.workflow.list(admin());
    for (const userId of [people.workspaceProjectAdmin, people.projectAdmin, work.users.member]) {
      const as = work.as(userId);
      await expect(
        work.services.boards.update(as, orgBoard.id, {
          config: withFilter(orgBoard.config, 'Nope'),
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        work.services.types.create(as, null, { key: 'chore', name: 'Chore' }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        work.services.fields.create(as, null, { key: 'team', name: 'Team', kind: 'text' }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        work.services.workflow.update(as, workflow!.id, { name: 'Renamed' }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(work.services.schemes.usage(as)).rejects.toBeInstanceOf(ForbiddenError);
    }
    // The project admin still configures their own project's board.
    const board = await boardOf(follows);
    await expect(
      work.services.boards.update(work.as(people.projectAdmin), board.id, {
        config: board.config,
      }),
    ).resolves.toMatchObject({ id: board.id });
  });

  it('says which projects follow each default and which run their own', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const { items } = await work.services.schemes.usage(admin());
    const row = (kind: string) => items.find((item) => item.kind === kind);
    expect(row('board')).toMatchObject({
      projects: 2,
      originName: 'Workspace board',
      overriders: [{ key: 'OWN' }],
    });
    expect(row('issue_types')?.overriders.map((project) => project.key)).toEqual(['OWN']);
    expect(row('fields')).toMatchObject({ projects: 2, overriders: [] });
    expect(row('workflow')).toMatchObject({ projects: 2, overriders: [] });
  });

  it('carries an org board change to projects that follow it, not to one with its own', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const ownBefore = (await boardOf(own)).config;
    const columns = orgBoard.config.columns.map((column, index) =>
      index === 0 ? { ...column, name: 'Ready', wipLimit: 5 } : column,
    );
    const saved = await work.services.boards.update(admin(), orgBoard.id, {
      config: { ...withFilter(orgBoard.config, 'Hot'), columns },
    });
    expect(saved.config.quickFilters.map((filter) => filter.name)).toContain('Hot');

    const followed = (await boardOf(follows)).config;
    expect(followed.quickFilters.map((filter) => filter.name)).toContain('Hot');
    expect(followed.columns[0]).toMatchObject({ name: 'Ready', wipLimit: 5 });
    expect((await work.services.schemes.list(admin(), follows.key)).items).toContainEqual(
      expect.objectContaining({ kind: 'board', overridden: false }),
    );
    expect((await boardOf(own)).config).toEqual(ownBefore);
    expect(work.realtime.some((message) => message.projectId === follows.id)).toBe(true);
  });

  it('keeps a project that changed its own board on its own version', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const board = await boardOf(follows);
    await work.services.boards.update(admin(), board.id, {
      config: withFilter(board.config, 'Mine'),
    });
    const current = (await work.services.boards.list(admin(), undefined))[0]!;
    await work.services.boards.update(admin(), current.id, {
      config: withFilter(current.config, 'Later'),
    });
    const names = (await boardOf(follows)).config.quickFilters.map((filter) => filter.name);
    expect(names).toContain('Mine');
    expect(names).not.toContain('Later');
  });

  it('follows the default again after Reset to default', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    await work.services.schemes.reset(work.as(people.projectAdmin), follows.key, 'board');
    const reset = (await boardOf(follows)).config.quickFilters.map((filter) => filter.name);
    expect(reset).toContain('Later');
    expect(reset).not.toContain('Mine');
    const current = (await work.services.boards.list(admin(), undefined))[0]!;
    await work.services.boards.update(admin(), current.id, {
      config: withFilter(current.config, 'Newest'),
    });
    const names = (await boardOf(follows)).config.quickFilters.map((filter) => filter.name);
    expect(names).toContain('Newest');
  });

  it('gives an org issue type to projects that follow, not to one that overrode them', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    await work.services.types.create(admin(), null, { key: 'spike', name: 'Spike' });
    const keys = async (project: Project) =>
      (await work.services.types.list(work.as(work.users.member), project.key)).items.map(
        (type) => type.key,
      );
    expect(await keys(follows)).toContain('spike');
    expect(await keys(own)).not.toContain('spike');
  });
});
