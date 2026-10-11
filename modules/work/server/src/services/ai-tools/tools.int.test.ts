import { randomUUID } from 'node:crypto';
import type { AiReadToolDefinition, AiWriteToolDefinition } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Project } from '../../../../shared/projects.ts';
import { startWorkHarness, type WorkHarness } from '../int-support.ts';
import { workAiTools } from './index.ts';

/*
 * The tools as an MCP client calls them, one at a time, against real Work services: what a
 * migration of a board's cards needs, from reading a type's required fields to creating an
 * issue where it already stands and getting its key back.
 */

let h: WorkHarness | undefined;
let skipped = '';
let plt: Project;
let bugTypeId = '';

beforeAll(async () => {
  const started = await startWorkHarness();
  if (!started.available) {
    skipped = started.reason;
    return;
  }
  h = started.harness;
  const admin = h.as(h.users.admin);
  plt = await h.project('PLT', [h.users.member]);
  await h.project('OPS', [h.users.outsider]);
  const foundIn = await h.services.fields.create(admin, null, {
    key: 'found_in',
    name: 'Found in',
    kind: 'select',
    options: [
      { value: 'prod', label: 'Production' },
      { value: 'staging', label: 'Staging' },
    ],
    filterable: false,
    aiFill: false,
  });
  const bug = (await h.services.types.list(admin, null)).items.find((type) => type.name === 'Bug');
  bugTypeId = bug?.id ?? '';
  await h.services.types.putLayout(admin, null, bugTypeId, {
    items: [{ fieldId: foundIn.id, required: true, onCard: false }],
  });
});

afterAll(async () => {
  await h?.stop();
});

function tool(name: string) {
  const found = workAiTools(h!.services).find((candidate) => candidate.name === name);
  if (!found) throw new Error(`No tool ${name}`);
  return found;
}

const runContext = (userId: string) => ({
  ...h!.as(userId),
  planId: randomUUID(),
  stepIndex: 0,
  attribution: 'via MCP for test',
  runId: null,
});

/** Authorizes and runs a write as MCP does, handing back its outcome. */
async function write(name: string, args: unknown, userId = h!.users.member) {
  const definition = tool(name) as AiWriteToolDefinition;
  const input = definition.input.parse(args);
  await definition.authorize(h!.as(userId), input);
  return definition.run(runContext(userId), input);
}

async function read<T>(name: string, args: unknown, userId = h!.users.member): Promise<T> {
  const definition = tool(name) as AiReadToolDefinition;
  return definition.execute(h!.as(userId), definition.input.parse(args)) as Promise<T>;
}

describe('Work tools over MCP', () => {
  it('lists each type with its fields, and names a missing required field', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const project = await read<{ issueTypes: { name: string; fields: unknown[] }[] }>(
      'work_get_project',
      { key: 'PLT' },
    );
    expect(project.issueTypes.find((type) => type.name === 'Bug')?.fields).toEqual([
      {
        key: 'found_in',
        name: 'Found in',
        type: 'select',
        required: true,
        options: ['prod', 'staging'],
      },
    ]);
    await expect(
      write('work_create_issue', { projectId: plt.id, type: 'bug', title: 'Crash on save' }),
    ).rejects.toThrow('Required fields are missing: Found in (found_in)');
    await expect(
      write('work_create_issue', {
        projectId: plt.id,
        type: 'Bug',
        title: 'Crash on save',
        customFields: { found_in: 'huge' },
      }),
    ).rejects.toThrow(/found_in: Expected a select value, one of prod, staging/);
  });

  it('creates an issue in any status, by names, and returns its key', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const epic = await write('work_create_issue', {
      projectId: plt.id,
      type: 'Epic',
      title: 'Checkout rewrite',
      customFields: { target_date: '2026-12-31', owner: h.users.member },
    });
    const long = `## Steps\n\n${'- Open the cart and press save.\n'.repeat(1500)}`;
    expect(long.length).toBeGreaterThan(40_000);
    const outcome = await write('work_create_issue', {
      projectId: plt.id,
      typeId: bugTypeId,
      title: 'Crash on save',
      customFields: { found_in: 'prod' },
      status: 'done',
      description: long,
      assigneeEmail: 'MO@example.test',
      parentKey: epic.result?.['key'],
    });
    const key = String(outcome.result?.['key']);
    expect(outcome.result).toEqual({ key, id: expect.any(String), href: `/work/issue/${key}` });
    const issue = await h.services.issues.get(h.as(h.users.member), key);
    expect(issue.status.name).toBe('Done');
    expect(issue.resolvedAt).not.toBeNull();
    expect(issue.assigneeId).toBe(h.users.member);
    expect(issue.parent?.key).toBe(epic.result?.['key']);
    expect(issue.customFields).toMatchObject({ found_in: 'prod' });
    expect(issue.descriptionText).toContain('Open the cart and press save.');
    expect(issue.description?.['content']).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'heading' })]),
    );

    const found = (
      await read<Record<string, unknown>[]>('work_search_issues', { q: 'project = PLT' })
    ).filter((item) => item['key'] === key);
    expect(found[0]).toMatchObject({
      key,
      type: 'Bug',
      parentKey: epic.result?.['key'],
      descriptionTruncated: true,
    });
    expect(String(found[0]?.['description'])).toMatch(/^## Steps/);
    expect(String(found[0]?.['description'])).toHaveLength(4000);
  });

  it('refuses a status outside the workflow and an assignee outside the project', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const base = { projectId: plt.id, type: 'Task', title: 'Tidy' };
    await expect(write('work_create_issue', { ...base, status: 'Shipped' })).rejects.toThrow(
      /No status "Shipped" in PLT's workflow: .*Done/,
    );
    await expect(
      write('work_create_issue', { ...base, assigneeEmail: 'otto@example.test' }),
    ).rejects.toThrow('otto@example.test is not an active member of PLT');
  });

  it('updates several fields at once, and undo puts them back', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const created = await h.issue(plt, 'Session cleanup');
    const definition = tool('work_update_issue') as AiWriteToolDefinition;
    const outcome = await write('work_update_issue', {
      key: created.key,
      title: 'Session cleanup job',
      type: 'Story',
      priority: 'high',
      assigneeEmail: 'mo@example.test',
      descriptionText: 'Runs **nightly**.',
    });
    expect(outcome.result).toMatchObject({ key: created.key, id: created.id });
    const member = h.as(h.users.member);
    const updated = await h.services.issues.get(member, created.key);
    expect([updated.title, updated.type.name, updated.priority, updated.assigneeId]).toEqual([
      'Session cleanup job',
      'Story',
      'high',
      h.users.member,
    ]);
    expect(updated.descriptionText).toBe('Runs nightly.');
    await definition.undo?.(runContext(h.users.member), outcome.undo);
    const undone = await h.services.issues.get(member, created.key);
    expect([undone.title, undone.type.name, undone.priority, undone.assigneeId]).toEqual([
      'Session cleanup',
      'Task',
      'medium',
      null,
    ]);
    expect(undone.description).toBeNull();
    await expect(write('work_update_issue', { key: created.key })).rejects.toThrow(
      'Nothing to change',
    );
  });

  it('deletes an issue and restores it on undo', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const created = await h.issue(plt, 'Duplicate card');
    const outcome = await write('work_delete_issue', { key: created.key }, h.users.admin);
    expect(outcome.result).toEqual({ key: created.key, id: created.id });
    const admin = h.as(h.users.admin);
    expect((await h.services.issues.get(admin, created.key)).deletedAt).not.toBeNull();
    await (tool('work_delete_issue') as AiWriteToolDefinition).undo?.(
      runContext(h.users.admin),
      outcome.undo,
    );
    expect((await h.services.issues.get(admin, created.key)).deletedAt).toBeNull();
  });

  it('links two issues by key', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const blocker = await h.issue(plt, 'Migrate sessions');
    const blocked = await h.issue(plt, 'Drop the cookie path');
    const outcome = await write('work_link_issues', {
      fromKey: blocker.key,
      toKey: blocked.key,
      kind: 'blocks',
    });
    expect(outcome.result).toMatchObject({ linkId: expect.any(String), kind: 'blocks' });
    const links = await h.services.links.list(h.as(h.users.member), blocked.key);
    expect(links).toEqual([
      expect.objectContaining({ sourceId: blocker.id, targetId: blocked.id, kind: 'blocks' }),
    ]);
  });

  it('lists projects and statuses, and creates a project', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const projects = await read<{ key: string }[]>('work_list_projects', {});
    expect(projects.map((project) => project.key)).toEqual(['PLT']);
    const statuses = await read<{ name: string; category: string; position: number }[]>(
      'work_list_statuses',
      { key: 'PLT' },
    );
    expect(statuses.map((status) => status.name)).toContain('Done');
    expect(statuses.map((status) => status.position)).toEqual(
      [...statuses.map((status) => status.position)].sort((a, b) => a - b),
    );
    const outcome = await write(
      'work_create_project',
      { key: 'mig', name: 'Migration' },
      h.users.admin,
    );
    expect(outcome.result).toEqual({
      id: expect.any(String),
      key: 'MIG',
      href: '/work/board/MIG',
    });
  });
});
