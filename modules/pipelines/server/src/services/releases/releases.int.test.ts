import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  releaseCompareSchema,
  releaseSchema,
  releasesPageSchema,
} from '../../../../shared/releases.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';
import { seedShippingFixture, type ShippingFixture } from '../../testing/shipping-fixture.ts';
import { createReleaseWriter } from './write.ts';

/* Creating a release once, reading it, and comparing two. */

const digest = (n: number) => `sha256:${String(n).repeat(64).slice(0, 64)}`;

describe('releases', () => {
  let harness: PipelinesHarness | undefined;
  let http: PipelinesHttp;
  let f: ShippingFixture;
  let reason = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    f = await seedShippingFixture(harness);
    http = await startPipelinesHttp(harness);
  });

  afterAll(async () => {
    await http?.app.close();
    await harness?.stop();
  });

  it('creates a release once and refuses the same version with other images', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const writer = createReleaseWriter();
    const input = {
      applicationId: f.app,
      version: 'v9.0.0',
      source: 'external' as const,
      commitSha: 'b81d7e2',
      imageDigests: { 'linux/amd64': digest(1) },
      externalUrl: 'https://ci.example.test/builds/42',
    };
    const first = await harness.sql.begin((tx) => writer.createRelease(tx, input));
    expect(first.created).toBe(true);
    const again = await harness.sql.begin((tx) => writer.createRelease(tx, input));
    expect(again).toEqual({ release: first.release, created: false });
    await expect(
      harness.sql.begin((tx) =>
        writer.createRelease(tx, { ...input, imageDigests: { 'linux/amd64': digest(2) } }),
      ),
    ).rejects.toThrow(/already exists with different images/);
  });

  it('lists and reads releases with where each one runs', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const v1 = await f.release('v1.0.0');
    const promotion = await f.service.requestPromotion(harness.as(harness.users.member), {
      release: v1,
      to: 'dev',
      mode: 'approval',
    });
    const sql = harness.sql;
    await f.runUntil(async () => {
      const [row] = await sql<{ state: string }[]>`
        select state from pipeline_promotions where id = ${promotion.promotion.id}`;
      return row?.state === 'succeeded';
    }, 5);
    const page = releasesPageSchema.parse(
      (await http.get('/releases', harness.users.member, { application: 'checkout-api' })).json(),
    );
    expect(page.items.map((item) => item.version)).toEqual(['v1.0.0', 'v9.0.0']);
    const one = releaseSchema.parse(
      (await http.get(`/releases/${v1}`, harness.users.member)).json(),
    );
    expect(one.environments.map((e) => e.key)).toEqual(['dev']);
    expect(one.testSummary).toEqual({ total: 12, passed: 12, failed: 0, skipped: 0 });
  });

  it('compares two releases: commits between them and changed configuration', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const older = await f.release('v10.0.0', { LOG_LEVEL: 'info', API_TOKEN: 'a' });
    const newer = await f.release('v10.1.0', {
      LOG_LEVEL: 'debug',
      API_TOKEN: 'b',
      migrations: [{ description: 'Add refunds.reason', reversible: true, reviewed: false }],
    });
    await harness.sql`update pipeline_releases set created_at = now() - interval '1 hour'
      where id = ${older}`;
    const [run] = await harness.sql<{ id: string }[]>`
      insert into pipeline_runs (trigger, ref, commit_sha, title, issue_key, state, created_at)
      values ('push', 'main', 'c0ffee1', 'Retry UPI collect', 'PAY-12', 'passed',
        now() - interval '30 minutes') returning id`;
    await harness.sql`insert into pipeline_run_applications (run_id, application_id)
      values (${run?.id ?? ''}, ${f.app})`;
    const compare = releaseCompareSchema.parse(
      (
        await http.get('/releases/compare', harness.users.member, { from: older, to: newer })
      ).json(),
    );
    expect(compare.commits.map((c) => c.sha)).toEqual(['c0ffee1']);
    expect(compare.issueKeys).toEqual(['PAY-12']);
    expect(compare.migrations).toHaveLength(1);
    expect(compare.config).toEqual([
      { name: 'API_TOKEN', from: null, to: null, secret: true },
      { name: 'LOG_LEVEL', from: 'info', to: 'debug', secret: false },
    ]);
  });
});
