import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness, type SignedInApp } from './boot-harness.ts';

/*
 * The AI insight surfaces on the real boot path: Work's projects and Docs' spaces reach
 * Settings › AI's exclusion picker, every module prompt file loads, and with AI off the
 * insight endpoints refuse with the reason the UI hides on.
 */

describe('ai insights in the host', () => {
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
    for (const id of ['work', 'docs']) {
      await call('POST', `/admin/modules/${id}/enable`, { access: { mode: 'everyone' } });
    }
  });

  afterAll(async () => harness?.stop());

  it("lists Work's projects and Docs' spaces as exclusion targets", async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const project = await call('POST', '/work/projects', { key: 'PLT', name: 'Platform' });
    const space = await call('POST', '/docs/spaces', { key: 'ENG', name: 'Engineering' });
    expect(project.status).toBe(201);
    expect(space.status).toBe(201);
    const targets = await call('GET', '/admin/ai/exclusion-targets');
    expect(targets.status).toBe(200);
    expect(targets.body.items).toEqual(
      expect.arrayContaining([
        { kind: 'project', id: project.body.id, name: 'Platform', key: 'PLT', moduleId: 'work' },
        { kind: 'space', id: space.body.id, name: 'Engineering', key: 'ENG', moduleId: 'docs' },
      ]),
    );
  });

  it('refuses every insight kind with AI off, saying so', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const target = '00000000-0000-7000-8000-000000000001';
    for (const kind of [
      'issue_summary',
      'page_tldr',
      'sprint_pulse',
      'morning_brief',
      'consistency',
    ]) {
      const read = await call('GET', `/ai/insights/${kind}/${target}`);
      expect(read.status).toBe(403);
      expect(read.body.details).toEqual({ reason: 'ai_off' });
    }
    const retry = await call('POST', `/ai/insights/issue_summary/${target}/refresh`);
    expect(retry.status).toBe(403);
    const unknown = await call('GET', `/ai/insights/forecast/${target}`);
    expect(unknown.status).toBe(400);
  });
});
