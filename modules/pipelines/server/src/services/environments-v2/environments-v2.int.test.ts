import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cloudAccessCheckResponseSchema } from '../../../../shared/cloud-reach.ts';
import { cloudConnectionSchema } from '../../../../shared/clouds.ts';
import {
  appliedSuggestedSetupSchema,
  environmentsV2ResponseSchema,
  environmentV2ViewSchema,
} from '../../../../shared/environments-v2.ts';
import {
  setupChecklistResponseSchema,
  startOverResponseSchema,
} from '../../../../shared/pipeline-setup.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';

/*
 * A fresh install set up over HTTP: the checklist starts with nothing done, Check access lists
 * the projects a reach covers without storing anything, connecting attaches them, the
 * suggested setup makes equal environments and an empty approval group, the path reorders,
 * and Start over leaves the install fresh again. The simulated cloud stands in for Google Cloud.
 */

let harness: PipelinesHarness | undefined;
let http: PipelinesHttp | undefined;
let skip = '';

beforeAll(async () => {
  const started = await startPipelinesHarness();
  if (!started.available) {
    skip = started.reason;
    return;
  }
  harness = started.harness;
  http = await startPipelinesHttp(harness);
});

afterAll(async () => {
  await http?.app.close();
  await harness?.stop();
});

const ready = () => {
  if (!harness || !http) throw new Error('no harness');
  return { h: harness, api: http };
};

const checklist = async () => {
  const { h, api } = ready();
  return setupChecklistResponseSchema.parse(
    (await api.get('/setup/checklist', h.users.member)).json(),
  );
};

const PROJECTS = ['example-dev', 'example-stage', 'example-prod'];

describe('a fresh install', () => {
  it('starts with nothing done and nothing switched on', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    // On a fresh install only the installing admin is in Pipelines; the harness also gives
    // its member a role, which would count as someone invited.
    await harness.sql`
      delete from pipeline_role_bindings where subject_kind = 'user' and scope_kind = 'organisation'`;
    const list = await checklist();
    expect(list.complete).toBe(false);
    expect(list.steps.map((step) => [step.key, step.done, step.blockedBy])).toEqual([
      ['cloud', false, null],
      ['environments', false, 'cloud'],
      ['people', false, null],
      ['services', false, null],
      ['pipelines', false, 'services'],
      ['templates', false, null],
    ]);
    expect(list.switchedOn).toEqual({ clouds: [], deployOnPush: false, versionSchemes: [] });
  });

  it('checks access for the projects picked, storing nothing', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const body = {
      provider: 'gcp',
      signIn: 'vm',
      reach: { kind: 'projects', projects: PROJECTS },
    };
    expect((await api.send('POST', '/clouds/access-check', h.users.member, body)).statusCode).toBe(
      403,
    );
    h.world.accountProblems.set('example-prod', ['Grant Cloud Run Developer on example-prod']);
    const checked = cloudAccessCheckResponseSchema.parse(
      (await api.send('POST', '/clouds/access-check', h.users.admin, body)).json(),
    );
    expect(checked.signedIn).toBe(true);
    expect(checked.projects.map((p) => [p.externalId, p.ok])).toEqual([
      ['example-dev', true],
      ['example-stage', true],
      ['example-prod', false],
    ]);
    h.world.accountProblems.delete('example-prod');
    const whoAmI = cloudAccessCheckResponseSchema.parse(
      (
        await api.send('POST', '/clouds/access-check', h.users.admin, { ...body, reach: undefined })
      ).json(),
    );
    expect(whoAmI.projects).toEqual([]);
    expect(whoAmI.principal).toBeTruthy();
    const [stored] = await h.sql<{ count: number }[]>`
      select count(*)::int as count from cloud_connections`;
    expect(stored?.count).toBe(0);
  });

  it('connects in attached mode by default and attaches every project the folder holds', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const created = await api.send('POST', '/clouds', h.users.admin, {
      provider: 'gcp',
      name: 'Google Cloud',
      signIn: 'vm',
      reach: { kind: 'folder', parent: '417302018845' },
    });
    expect(created.statusCode).toBe(201);
    const connection = cloudConnectionSchema.parse(created.json());
    expect(connection).toMatchObject({
      mode: 'attached',
      status: 'connected',
      reach: { kind: 'folder', parent: 'folders/417302018845' },
    });
    const accounts = await h.sql<{ external_id: string; status: string }[]>`
      select external_id, status from cloud_accounts order by external_id`;
    expect(accounts.map((a) => a.external_id)).toEqual(
      [...h.world.reachable].sort((a, b) => a.localeCompare(b)),
    );
    expect((await checklist()).steps[0]).toMatchObject({ key: 'cloud', done: true });
  });

  it('applies the suggested setup: equal environments and an empty approval group', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const project = (externalId: string) => ({ provider: 'gcp', externalId, region: null });
    const body = {
      environments: [
        { name: 'Dev', key: 'dev', project: project('example-dev') },
        {
          name: 'Stage',
          key: 'stage',
          project: project('example-stage'),
          versionsAllowed: 'passed_previous',
        },
        {
          name: 'Live',
          key: 'live',
          project: project('example-prod'),
          versionsAllowed: 'passed_previous',
          approval: { groupName: 'Live approvers', count: 1 },
        },
      ],
    };
    const applied = await api.send('POST', '/environments-v2/suggested', h.users.admin, body);
    expect(applied.statusCode).toBe(201);
    const result = appliedSuggestedSetupSchema.parse(applied.json());
    expect(result.groups.map((g) => g.name)).toEqual(['Live approvers']);
    expect(result.items.map((e) => [e.key, e.position, e.versionsAllowed])).toEqual([
      ['dev', 0, 'any'],
      ['stage', 1, 'passed_previous'],
      ['live', 2, 'passed_previous'],
    ]);
    const live = result.items[2];
    expect(live?.approvalSteps).toMatchObject([
      { count: 1, when: 'always', groupRef: { name: 'Live approvers' } },
    ]);
    expect(result.items[0]).toMatchObject({ approvalRule: null, window: null, deployers: null });
    const [classes] = await h.sql<{ count: number }[]>`
      select count(*)::int as count from pipeline_environments where class is not null`;
    expect(classes?.count).toBe(0);
    const again = await api.send('POST', '/environments-v2/suggested', h.users.admin, body);
    expect(again.statusCode).toBe(409);
  });

  it('edits, reorders and removes environments, and frees a removed ID', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const renamed = await api.send('PATCH', '/environments-v2/stage', h.users.admin, {
      name: 'Staging',
      key: 'staging',
      window: { days: ['mon', 'tue'], from: '10:00', to: '18:00', timeZone: 'UTC' },
    });
    expect(environmentV2ViewSchema.parse(renamed.json())).toMatchObject({
      key: 'staging',
      name: 'Staging',
      window: { days: ['mon', 'tue'] },
    });
    const missingGroup = await api.send('PATCH', '/environments-v2/dev', h.users.admin, {
      approvalRule: {
        steps: [{ group: '0190f3c2-0000-7000-8000-000000000000', count: 1, when: 'always' }],
      },
    });
    expect(missingGroup.statusCode).toBe(404);
    const order = await api.send('PUT', '/environments-v2/order', h.users.admin, {
      keys: ['staging', 'dev', 'live'],
    });
    expect(environmentsV2ResponseSchema.parse(order.json()).items.map((e) => e.key)).toEqual([
      'staging',
      'dev',
      'live',
    ]);
    const partial = await api.send('PUT', '/environments-v2/order', h.users.admin, {
      keys: ['dev'],
    });
    expect(partial.statusCode).toBe(400);
    expect((await api.send('DELETE', '/environments-v2/dev', h.users.admin)).statusCode).toBe(204);
    const back = await api.send('POST', '/environments-v2', h.users.admin, {
      name: 'Dev',
      key: 'dev',
    });
    expect(environmentV2ViewSchema.parse(back.json())).toMatchObject({ key: 'dev', position: 2 });
    const unknown = await api.send('POST', '/environments-v2', h.users.admin, {
      name: 'QA',
      key: 'qa',
      project: { provider: 'gcp', externalId: 'nobody-has-this', region: null },
    });
    expect(unknown.statusCode).toBe(400);
  });

  it('starts over: every Pipelines record goes and the checklist is empty again', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const refused = await api.send('POST', '/setup/reset', h.users.admin, { confirm: 'yes' });
    expect(refused.statusCode).toBe(400);
    const member = await api.send('POST', '/setup/reset', h.users.member, {
      confirm: 'start over',
    });
    expect(member.statusCode).toBe(403);
    const reset = await api.send('POST', '/setup/reset', h.users.admin, { confirm: 'start over' });
    expect(startOverResponseSchema.parse(reset.json()).removed).toBeGreaterThan(0);
    const list = await checklist();
    expect(list.steps.every((step) => !step.done)).toBe(true);
    const [users] = await h.sql<{ count: number }[]>`select count(*)::int as count from users`;
    expect(users?.count).toBe(3);
  });
});
