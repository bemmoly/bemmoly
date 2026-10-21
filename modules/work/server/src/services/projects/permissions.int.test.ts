import { ForbiddenError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPlanning, type Planning } from '../boards/planning-harness.ts';

/*
 * Permissions per action against a real database and the kernel's authorization: a custom
 * Scrum Master role alone runs sprints once Member is denied them, a project role override
 * takes workflow and automation editing from a project admin, epics need their own action,
 * and the permissions read reports what each person holds.
 */
describe('Work actions per role', () => {
  let planning: Planning | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startPlanning();
    if ('planning' in started) planning = started.planning;
    else skipReason = started.reason;
  });
  afterAll(async () => planning?.stop());

  const deny = async (sql: Planning['sql'], roleKey: string, capabilities: string[]) => {
    for (const capability of capabilities) {
      await sql`
        insert into role_capabilities (role_id, capability, allowed)
        select id, ${capability}, false from roles where key = ${roleKey}
        on conflict (role_id, capability) do update set allowed = false`;
    }
  };

  it('lets only the Scrum Master create, start and complete sprints', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { services, sql } = planning;
    const [role] = await sql<{ id: string }[]>`
      insert into roles (key, name) values ('scrum_master', 'Scrum Master') returning id`;
    const roleId = (role as { id: string }).id;
    for (const capability of [
      'work.issue.view',
      'work.issue.edit',
      'work.sprint.create',
      'work.sprint.start',
      'work.sprint.complete',
    ]) {
      await sql`
        insert into role_capabilities (role_id, capability, allowed)
        values (${roleId}, ${capability}, true)`;
    }
    await deny(sql, 'member', ['work.sprint.create', 'work.sprint.start', 'work.sprint.complete']);

    const ana = await planning.user('Ana');
    const sam = await planning.user('Sam');
    const projectId = await planning.project('SCR', 'scrum', [
      [ana, 'member'],
      [sam, 'scrum_master'],
    ]);
    const asAna = planning.ctx(ana);
    const asSam = planning.ctx(sam);

    await expect(services.sprints.create(asAna, 'SCR', { name: 'Ana' })).rejects.toThrow(
      ForbiddenError,
    );
    const sprint = await services.sprints.create(asSam, projectId, { name: 'Sprint 1' });
    await expect(services.sprints.start(asAna, sprint.id, {})).rejects.toThrow(ForbiddenError);
    await expect(services.sprints.start(asSam, sprint.id, {})).resolves.toMatchObject({
      state: 'active',
    });
    await expect(
      services.sprints.complete(asAna, sprint.id, { moveUnfinishedTo: 'backlog' }),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      services.sprints.complete(asSam, sprint.id, { moveUnfinishedTo: 'backlog' }),
    ).resolves.toMatchObject({ state: 'closed' });

    // Member still edits and moves issues; only the sprint actions moved to the Scrum Master.
    await expect(planning.issue(asAna, { projectId, title: 'Still mine' })).resolves.toBeTruthy();

    const anaHolds = (await services.members.permissions(asAna, 'SCR')).actions;
    expect(anaHolds).toContain('work.issue.edit');
    expect(anaHolds).not.toContain('work.sprint.start');
    const samHolds = (await services.members.permissions(asSam, 'SCR')).actions;
    expect(samHolds).toEqual(
      expect.arrayContaining(['work.sprint.create', 'work.sprint.start', 'work.sprint.complete']),
    );
    expect(samHolds).not.toContain('work.project.configure');
  });

  it('takes workflow and automation editing from a project admin by project override', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { services, sql } = planning;
    const lee = await planning.user('Lee');
    const projectId = await planning.project('OVR', 'kanban', [[lee, 'project_admin']]);
    const asLee = planning.ctx(lee);
    const rule = {
      name: 'Say hello',
      projectId,
      trigger: { name: 'issue_created' },
      actions: [{ name: 'add_comment', args: { body: 'Hello' } }],
    };

    const first = await services.workflow.create(asLee, { name: 'Before', projectId });
    expect(first.name).toBe('Before');

    for (const capability of ['work.workflow.configure', 'work.automation.edit']) {
      await sql`
        insert into project_role_capabilities (project_id, role_id, capability, allowed)
        select ${projectId}, id, ${capability}, false from roles where key = 'project_admin'`;
    }
    // A request resolves capabilities once, so the check after the change is a new one.
    const again = planning.ctx(lee);
    await expect(services.workflow.create(again, { name: 'After', projectId })).rejects.toThrow(
      ForbiddenError,
    );
    await expect(services.automation.create(again, rule)).rejects.toThrow(ForbiddenError);
    const held = (await services.members.permissions(again, 'OVR')).actions;
    // The workflow scheme follows "Configure workflows"; fields stay with "Configure project".
    await expect(services.schemes.reset(again, 'OVR', 'workflow')).rejects.toThrow(ForbiddenError);
    await services.schemes.override(again, 'OVR', 'fields');
    expect(held).toContain('work.project.configure');
    expect(held).not.toContain('work.workflow.configure');
    expect(held).not.toContain('work.automation.edit');
  });

  it('asks for "Manage epics" to create an epic, not a task', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { sql } = planning;
    await deny(sql, 'contractor', ['work.epic.manage']);
    const kit = await planning.user('Kit', 'contractor');
    const projectId = await planning.project('EPC', 'scrum', [[kit, 'contractor']]);
    const asKit = planning.ctx(kit);
    const [epic] = await sql<{ id: string }[]>`
      select id from issue_types where project_id is null and level = 'epic' limit 1`;

    await expect(
      planning.issue(asKit, { projectId, title: 'Big', typeId: (epic as { id: string }).id }),
    ).rejects.toThrow(ForbiddenError);
    await expect(planning.issue(asKit, { projectId, title: 'Small' })).resolves.toBeTruthy();
  });

  it('asks for "Manage epics" on every other change to an existing epic', async (ctx) => {
    if (!planning) return ctx.skip(skipReason);
    const { services, sql } = planning;
    const [member] = await sql<{ id: string }[]>`select id from roles where key = 'member'`;
    const memberId = (member as { id: string }).id;
    await sql`
      insert into role_capabilities (role_id, capability, allowed) values
        (${memberId}, 'work.issue.delete', true), (${memberId}, 'work.epic.manage', false)
      on conflict (role_id, capability) do update set allowed = excluded.allowed`;
    const max = await planning.user('Max');
    const projectId = await planning.project('EPX', 'scrum', [[max, 'member']]);
    const asMax = planning.ctx(max);
    const epic = await planning.issue(asMax, { projectId, title: 'Will be an epic' });
    const task = await planning.issue(asMax, { projectId, title: 'Stays a task' });
    await sql`
      update issues set type_id = (
        select id from issue_types where project_id is null and level = 'epic' limit 1)
      where id = ${epic.id}`;

    await expect(services.issues.archive(asMax, epic.key)).rejects.toThrow(ForbiddenError);
    await expect(
      services.issues.setAssignees(asMax, epic.key, { assigneeIds: [max] }),
    ).rejects.toThrow(ForbiddenError);
    await expect(services.issues.rank(asMax, epic.key, { afterIssueId: task.id })).rejects.toThrow(
      ForbiddenError,
    );
    await sql`update issues set deleted_at = now() where id = ${epic.id}`;
    await expect(services.issues.restore(asMax, epic.key)).rejects.toThrow(ForbiddenError);

    await expect(services.issues.archive(asMax, task.key)).resolves.toBeTruthy();
    await expect(services.issues.unarchive(asMax, task.key)).resolves.toBeTruthy();
  });
});
