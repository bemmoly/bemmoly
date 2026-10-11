import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness, type SignedInApp } from './boot-harness.ts';

/*
 * Work with no other module on: the host must not lean on Docs (or any other module) for
 * the paths every Work team uses first. Creating an issue once returned 500 here because a
 * cross-module hook assumed Docs was running.
 */

const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('Work alone in the host', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';
  let app: SignedInApp;

  const call = async (method: string, url: string, payload?: unknown) => {
    const response = await app.inject({
      method: method as 'GET',
      url: `/api/v1${url}`,
      ...(payload !== undefined ? { payload: payload as object } : {}),
    });
    return { status: response.statusCode, body: response.body ? response.json() : null };
  };

  beforeAll(async () => {
    const started = await startBootHarness();
    if (!started.available) {
      skipReason = started.reason;
      return;
    }
    harness = started.harness;
    app = await harness.boot();
    const enabled = await call('POST', '/admin/modules/work/enable', {
      access: { mode: 'everyone' },
    });
    expect(enabled.status).toBe(200);
  });

  afterAll(async () => harness?.stop());

  it('keeps Docs off', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const modules = await call('GET', '/admin/modules');
    const docs = (modules.body.items as { id: string; enabled: boolean }[]).find(
      (module) => module.id === 'docs',
    );
    expect(docs?.enabled ?? false).toBe(false);
  });

  it('creates issues, comments on them and moves them', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const project = await call('POST', '/work/projects', { key: 'OPS', name: 'Operations' });
    expect(project.status).toBe(201);
    const types = (await call('GET', '/work/projects/OPS/issue-types')).body.items as {
      id: string;
      key: string;
    }[];
    const typeId = types.find((type) => type.key === 'task')?.id;
    const sprint = await call('POST', '/work/projects/OPS/sprints', { name: 'Sprint 1' });
    expect(sprint.status).toBe(201);

    const first = await call('POST', '/work/issues', {
      projectId: project.body.id,
      typeId,
      title: 'Rotate the backup keys',
    });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    const second = await call('POST', '/work/issues', {
      projectId: project.body.id,
      typeId,
      title: 'Write the restore runbook',
      description: doc('Start once OPS-1 is done.'),
    });
    expect(second.status, JSON.stringify(second.body)).toBe(201);

    const comment = await call('POST', '/work/issues/OPS-1/comments', { body: doc('On it.') });
    expect(comment.status, JSON.stringify(comment.body)).toBe(201);
    const comments = await call('GET', '/work/issues/OPS-1/comments');
    expect(comments.body.items).toHaveLength(1);

    const moved = await call('POST', '/work/issues/OPS-1/move', { sprintId: sprint.body.id });
    expect(moved.status, JSON.stringify(moved.body)).toBe(200);
    expect(moved.body.sprintId).toBe(sprint.body.id);

    const transitions = await call('GET', '/work/issues/OPS-1/transitions');
    expect(transitions.status).toBe(200);
    const next = (transitions.body.items as { toStatusId: string }[])[0];
    expect(next).toBeDefined();
    const updated = await call('PATCH', '/work/issues/OPS-1', { statusId: next?.toStatusId });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    expect(updated.body.statusId).toBe(next?.toStatusId);
  });
});
