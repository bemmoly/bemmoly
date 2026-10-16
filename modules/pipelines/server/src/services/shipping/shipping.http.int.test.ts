import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  canaryAnalysisSchema,
  deploymentDetailSchema,
  deploymentsPageSchema,
} from '../../../../shared/deployments.ts';
import {
  promotionPreviewSchema,
  promotionSchema,
  promotionsPageSchema,
} from '../../../../shared/promotions.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';
import { seedShippingFixture, type ShippingFixture } from '../../testing/shipping-fixture.ts';

/* The promotion and deployment endpoints as the web app calls them. */

describe('promotion and deployment endpoints', () => {
  let harness: PipelinesHarness | undefined;
  let http: PipelinesHttp;
  let f: ShippingFixture;
  let reason = '';
  let v1 = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    f = await seedShippingFixture(harness);
    http = await startPipelinesHttp({
      ...harness,
      services: { ...harness.services, shipping: f.service },
    });
    v1 = await f.release('v1.0.0');
  });

  afterAll(async () => {
    await http?.app.close();
    await harness?.stop();
  });

  const priya = () => harness?.users.member ?? '';

  it('previews a promotion without writing anything', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const response = await http.get('/promotions/preview', priya(), { release: v1, to: 'prod' });
    expect(response.statusCode).toBe(200);
    const preview = promotionPreviewSchema.parse(response.json());
    expect(preview.environments.map((e) => e.key)).toEqual(['prod-asia-south1', 'prod-us-east1']);
    expect(preview.request.allowed).toBe(false);
    expect(preview.request.sentence).toMatch(/has not reached the stage before/);
    expect(preview.requirements[0]?.needed).toBe(1);
    const [count] = await harness.sql<
      { n: number }[]
    >`select count(*)::int as n from pipeline_promotions`;
    expect(count?.n).toBe(0);
  });

  it('requests, reads and lists a promotion, and answers twice with the same one', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const created = await http.send('POST', '/promotions', priya(), { release: v1, to: 'dev' });
    expect(created.statusCode).toBe(201);
    const promotion = promotionSchema.parse(created.json());
    const again = await http.send('POST', '/promotions', priya(), { release: v1, to: 'dev' });
    expect([200, 201]).toContain(again.statusCode);
    const read = await http.get(`/promotions/${promotion.id}`, priya());
    expect(promotionSchema.parse(read.json()).release.version).toBe('v1.0.0');
    const page = promotionsPageSchema.parse(
      (await http.get('/promotions', priya(), { application: 'checkout-api' })).json(),
    );
    expect(page.items.map((item) => item.id)).toContain(promotion.id);
    const sql = harness.sql;
    await f.runUntil(async () => {
      const [row] = await sql<{ state: string }[]>`
        select state from pipeline_promotions where id = ${promotion.id}`;
      return row?.state === 'succeeded';
    }, 5);
    const deployments = deploymentsPageSchema.parse(
      (await http.get('/deployments', priya(), { environment: 'dev' })).json(),
    );
    expect(deployments.items[0]).toMatchObject({ state: 'succeeded', trafficPercent: 100 });
    const detail = deploymentDetailSchema.parse(
      (await http.get(`/deployments/${deployments.items[0]?.id}`, priya())).json(),
    );
    expect(detail.events.map((event) => event.state)).toEqual([
      'pending',
      'deploying',
      'succeeded',
    ]);
    const canary = canaryAnalysisSchema.parse(
      (await http.get(`/deployments/${detail.id}/canary`, priya())).json(),
    );
    expect(canary.source).toBe('metrics');
  });

  it('keeps people without Pipelines out', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const response = await http.get('/promotions', harness.users.outsider);
    expect(response.statusCode).toBe(403);
    const request = await http.send('POST', '/promotions', harness.users.outsider, {
      release: v1,
      to: 'dev',
    });
    expect(request.statusCode).toBe(403);
  });

  it('refuses a promotion id that is not one', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const response = await http.send('POST', '/promotions/not-a-uuid/approvals', priya(), {});
    expect(response.statusCode).toBe(400);
  });
});
