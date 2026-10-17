import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { environmentsResponseSchema } from '../../../../shared/environments.ts';
import { overviewSchema } from '../../../../shared/overview.ts';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';

describe('environments, teams and overview endpoints', () => {
  let harness: PipelinesHarness | undefined;
  let http: PipelinesHttp;
  let reason = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    await seedCatalogFixture(harness.sql, harness.users.member);
    http = await startPipelinesHttp(harness);
  });

  afterAll(async () => {
    await http?.app.close();
    await harness?.stop();
  });

  const member = () => harness?.users.member ?? '';

  it('lists environments left to right with protection defaults filled in', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const body = environmentsResponseSchema.parse(
      (await http.get('/environments', member())).json(),
    );
    expect(body.items.map((environment) => environment.key)).toEqual([
      'dev',
      'staging',
      'prod-asia-south1',
    ]);
    expect(body.items[2]?.protection).toEqual({
      protected: true,
      controlPlaneOnly: false,
      requiresApproval: true,
      window: null,
    });
  });

  it('lists each tier path with its stages', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const body = (await http.get('/environments/paths', member())).json();
    expect(body.items).toEqual([
      expect.objectContaining({
        tier: 0,
        steps: [
          expect.objectContaining({ stage: 0, autoPromote: true }),
          expect.objectContaining({ stage: 2, autoPromote: false }),
        ],
      }),
    ]);
  });

  it('lists teams with their applications and marks the person’s own', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const all = (await http.get('/teams', member())).json();
    expect(all.items).toEqual([
      expect.objectContaining({
        name: 'Payments',
        applicationCount: 2,
        memberCount: 1,
        mine: true,
      }),
      expect.objectContaining({ name: 'Search', applicationCount: 2, mine: false }),
    ]);
    const mine = (await http.get('/teams', member(), { mine: 'true' })).json();
    expect(mine.items.map((team: { name: string }) => team.name)).toEqual(['Payments']);
  });

  it('answers the header numbers and live counter for the organisation and a scope', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const organisation = overviewSchema.parse((await http.get('/overview', member())).json());
    expect(organisation.scope.organisation).toBe('Acme');
    expect(organisation.today.runs).toBe(1);
    expect(organisation.live).toEqual({ running: 1, queued: 2 });
    expect(organisation.today.leadTimeSeconds).toBe(9600);
    expect(organisation.catalog).toEqual({ applications: 5, domains: 2, teams: 2 });
    expect(organisation.me.firstName).toBe('Priya');
    const data = overviewSchema.parse(
      (await http.get('/overview', member(), { scope: 'data' })).json(),
    );
    expect(data.scope.domain?.key).toBe('data');
    expect(data.live).toEqual({ running: 0, queued: 0 });
    expect(data.today.runs).toBe(0);
    expect((await http.get('/overview', member(), { scope: 'nope' })).statusCode).toBe(404);
  });
});
