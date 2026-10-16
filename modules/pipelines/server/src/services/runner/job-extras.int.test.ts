import { gzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { createPool, givePipeline } from '../../testing/execution.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { expireLogs } from '../logs/retention.ts';

/* What a job carries beyond its steps: the release it becomes, and its secrets. */

const at = () => new Date().toISOString();

describe('releases and secrets through the runner protocol', () => {
  let harness: PipelinesHarness | undefined;
  let reason = '';
  let poolToken = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    await seedCatalogFixture(harness.sql, harness.users.member);
    poolToken = (await createPool(harness.sql, 'linux-x64')).token;
  });

  afterAll(async () => {
    await harness?.services.wakeups.stop();
    await harness?.stop();
  });

  it('turns a passing build on the default branch into a release, once', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { services, users, sql } = harness;
    const member = harness.as(users.member);
    await givePipeline(sql, 'checkout-api', { checkout: false, build: {} });
    const run = await services.runs.create(member, {
      application: 'checkout-api',
      commitSha: 'f00dfeed1234',
    });
    const { runnerToken } = await services.runner.register({
      poolToken,
      name: 'builder',
      version: '0.1.0',
    });
    const job = await services.runner.claim(runnerToken, { waitSeconds: 0 });
    expect(job?.steps[0]?.env).toMatchObject({ BEMMOLY_BUILD_IMAGE: 'bemmoly-local/checkout-api' });
    const digest = `sha256:${'ab'.repeat(32)}`;
    await services.runner.finish(job?.jobId ?? '', job?.jobToken, {
      state: 'passed',
      imageDigests: { 'linux/amd64': digest },
      at: at(),
    });
    expect(harness.jobs).toContainEqual({
      name: 'pipelines.release-from-run',
      payload: { runId: run.id },
      idempotencyKey: `release:${run.id}`,
    });
    expect(await services.releaseFrom(run.id)).toBe(1);
    const releases = await sql<{ version: string; run_id: string; image_digests: unknown }[]>`
      select version, run_id, image_digests from pipeline_releases where run_id = ${run.id}`;
    expect(releases).toEqual([
      { version: 'f00dfee', run_id: run.id, image_digests: { 'linux/amd64': digest } },
    ]);
    expect(await services.releaseFrom(run.id)).toBe(0);
  });

  it('hands a job its secrets, masks them in logs, and gives a fork none', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { services, users, sql } = harness;
    const member = harness.as(users.member);
    await sql`
      insert into pipeline_variables (application_id, name, value)
      select id, 'DEPLOY_TOKEN', 'hunter2-secret' from pipeline_applications where key = 'checkout-api'`;
    await givePipeline(sql, 'checkout-api', {
      checkout: false,
      test: [{ name: 'Unit', run: 'echo $DEPLOY_TOKEN', secrets: ['DEPLOY_TOKEN'] }],
    });
    const run = await services.runs.create(member, {
      application: 'checkout-api',
      commitSha: 'c0ffee12',
    });
    const { runnerToken } = await services.runner.register({
      poolToken,
      name: 'secrets',
      version: '0.1.0',
    });
    const job = await services.runner.claim(runnerToken, { waitSeconds: 0 });
    expect(job?.secrets).toEqual(['DEPLOY_TOKEN']);
    expect(await services.runner.secrets(job?.jobId ?? '', job?.jobToken)).toEqual({
      values: { DEPLOY_TOKEN: 'hunter2-secret' },
    });
    await services.runner.logs(job?.jobId ?? '', job?.jobToken, {
      seq: 0,
      firstLine: 1,
      lineCount: 1,
      gzipBase64: gzipSync(JSON.stringify(['token is hunter2-secret'])).toString('base64'),
    });
    const log = await services.logs.range(member, job?.jobId ?? '', {});
    expect(log.lines[0]?.text).toBe('token is ***');
    await services.runner.finish(job?.jobId ?? '', job?.jobToken, { state: 'passed', at: at() });
    await sql`update pipeline_runs set from_fork = true where id = ${run.id}`;
    await services.runs.rerun(member, run.id, { only: 'all' });
    const fork = await services.runner.claim(runnerToken, { waitSeconds: 0 });
    expect(await services.runner.secrets(fork?.jobId ?? '', fork?.jobToken)).toEqual({
      values: {},
    });
    await services.runner.finish(fork?.jobId ?? '', fork?.jobToken, { state: 'passed', at: at() });
  });

  it('hands secrets out once, before the first step starts', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { services, users, sql } = harness;
    await givePipeline(sql, 'checkout-api', {
      checkout: false,
      test: [{ name: 'Unit', run: 'echo $DEPLOY_TOKEN', secrets: ['DEPLOY_TOKEN'] }],
    });
    await services.runs.create(harness.as(users.member), {
      application: 'checkout-api',
      commitSha: 'feedc0de',
    });
    const { runnerToken } = await services.runner.register({
      poolToken,
      name: 'once',
      version: '0.1.0',
    });
    const job = await services.runner.claim(runnerToken, { waitSeconds: 0 });
    const id = job?.jobId ?? '';
    expect((await services.runner.secrets(id, job?.jobToken)).values).toHaveProperty(
      'DEPLOY_TOKEN',
    );
    await services.runner.stepState(id, 0, job?.jobToken, { state: 'running', at: at() });
    // A step holds the job token too; it must not be able to collect the job's secrets.
    await expect(services.runner.secrets(id, job?.jobToken)).rejects.toThrow(/once/);
    await services.runner.finish(id, job?.jobToken, { state: 'passed', at: at() });
    await expect(services.runner.secrets(id, job?.jobToken)).rejects.toThrow(/once/);
  });

  it('lets logs and artifacts go after the retention period, keeping the run', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { sql } = harness;
    const deleted: string[] = [];
    const [chunks] = await sql<
      { count: number }[]
    >`select count(*)::int as count from pipeline_log_chunks`;
    expect(chunks?.count).toBeGreaterThan(0);
    expect(await expireLogs(sql, { delete: async (key) => void deleted.push(key) }, 30)).toEqual({
      chunks: 0,
      artifacts: 0,
    });
    await sql`update pipeline_jobs set finished_at = now() - interval '40 days' where finished_at is not null`;
    const expired = await expireLogs(sql, { delete: async (key) => void deleted.push(key) }, 30);
    expect(expired.chunks).toBe(chunks?.count);
    expect(deleted[0]).toMatch(/^logs\//);
    const [runs] = await sql<{ count: number }[]>`select count(*)::int as count from pipeline_runs`;
    expect(runs?.count).toBeGreaterThan(0);
  });
});
