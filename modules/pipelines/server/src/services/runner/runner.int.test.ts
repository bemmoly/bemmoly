import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runDetailSchema, runGraphSchema } from '../../../../shared/runs.ts';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { createPool, givePipeline } from '../../testing/execution.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';

const at = () => new Date().toISOString();

describe('running a pipeline through the runner protocol', () => {
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
    await givePipeline(harness.sql, 'checkout-api');
  });

  afterAll(async () => {
    await harness?.services.wakeups.stop();
    await harness?.stop();
  });

  it('runs a manual run end to end: claims, logs, tests, finish and the DAG', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { services, users } = harness;
    const member = harness.as(users.member);
    const run = await services.runs.create(member, {
      application: 'checkout-api',
      commitSha: 'a1c9e3f0',
      inputs: { suite: 'full' },
    });
    expect(runDetailSchema.parse(run).number).toBe(1);
    expect(run.jobs.map((job) => [job.key, job.state])).toEqual([
      ['build', 'ready'],
      ['unit-1', 'pending'],
      ['unit-2', 'pending'],
      ['lint-22', 'pending'],
      ['lint-24', 'pending'],
      ['report', 'pending'],
    ]);
    expect(run.jobs[1]?.waitReason?.text).toBe('Waits for Build');
    expect(run.jobs[0]?.waitReason?.text).toContain('No runner in linux-x64 is online');

    const runner = services.runner;
    const registered = await runner.register({ poolToken, name: 'laptop', version: '0.1.0' });
    const token = registered.runnerToken;
    const build = await runner.claim(token, { waitSeconds: 0 });
    expect(build).toMatchObject({ key: 'build', checkout: false, runNumber: 1 });
    expect(build?.steps[0]?.uses).toBe('bemmoly/build');
    expect(build?.env).toMatchObject({ BEMMOLY_INPUT_SUITE: 'full' });
    const jobToken = build?.jobToken ?? '';
    const jobId = build?.jobId ?? '';
    await runner.jobState(jobId, jobToken, { state: 'running', at: at() });
    await runner.stepState(jobId, 0, jobToken, { state: 'running', firstLine: 1, at: at() });
    await runner.logs(jobId, jobToken, {
      seq: 0,
      firstLine: 1,
      stepPosition: 0,
      lineCount: 2,
      lines: ['\u001b[32mStep 1/3\u001b[0m see https://example.test/x', 'built'],
    });
    // A resent chunk is acknowledged and stored once.
    await runner.logs(jobId, jobToken, { seq: 0, firstLine: 1, lineCount: 1, lines: ['dup'] });
    await runner.stepState(jobId, 0, jobToken, { state: 'passed', exitCode: 0, at: at() });
    await runner.finish(jobId, jobToken, { state: 'passed', at: at() });

    const log = await services.logs.range(member, jobId, {});
    expect(log.totalLines).toBe(2);
    expect(log.lines[0]?.spans).toEqual([
      { text: 'Step 1/3', kind: 'success' },
      { text: ' see ', kind: 'plain' },
      { text: 'https://example.test/x', kind: 'link', href: 'https://example.test/x' },
    ]);
    expect(log.complete).toBe(true);
    const found = await services.logs.search(member, jobId, { q: 'BUILT', limit: 10 });
    expect(found.matches).toEqual([{ line: 2, text: 'built', ranges: [[0, 5]] }]);

    const afterBuild = await services.runs.get(member, run.id);
    expect(afterBuild.state).toBe('running');
    expect(afterBuild.jobs.filter((job) => job.state === 'ready')).toHaveLength(4);
    expect(afterBuild.jobs[0]?.steps[0]).toMatchObject({
      state: 'passed',
      exitCode: 0,
      lineCount: 2,
    });

    // Unit 1 fails a test; the rest pass; Report is skipped behind the failure.
    const seen: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const job = await runner.claim(token, { waitSeconds: 0 });
      if (!job) throw new Error('expected a job');
      seen.push(job.key);
      await runner.jobState(job.jobId, job.jobToken, { state: 'running', at: at() });
      if (job.key === 'unit-1') {
        const split = await runner.splits(job.jobId, job.jobToken, {
          files: ['a.test.ts', 'b.test.ts'],
        });
        expect(split.files).toHaveLength(1);
        await runner.logs(job.jobId, job.jobToken, {
          seq: 0,
          firstLine: 1,
          lineCount: 2,
          lines: ['ok 12 passed', 'Error: expected 200 to be 201 at 10.0.0.1:443'],
        });
        await runner.tests(job.jobId, job.jobToken, {
          total: 2,
          passed: 1,
          failed: 1,
          skipped: 0,
          durationMs: 1200,
          cases: [
            { file: 'a.test.ts', name: 'pays', outcome: 'passed', durationMs: 700 },
            {
              file: 'b.test.ts',
              name: 'refunds',
              outcome: 'failed',
              durationMs: 500,
              message: 'expected 200 to be 201',
            },
          ],
        });
        await runner.finish(job.jobId, job.jobToken, { state: 'failed', at: at() });
      } else {
        await runner.finish(job.jobId, job.jobToken, { state: 'passed', at: at() });
      }
    }
    expect(seen.sort()).toEqual(['lint-22', 'lint-24', 'unit-1', 'unit-2']);
    const failed = await services.runs.get(member, run.id);
    expect(failed.state).toBe('failed');
    expect(failed.jobs.find((job) => job.key === 'report')?.state).toBe('skipped');
    const unit = failed.jobs.find((job) => job.key === 'unit-1');
    expect(unit?.failureSummary).toBe('Error: expected 200 to be 201 at 10.0.0.1:443');
    expect(unit?.failureFingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(failed.tests).toMatchObject({ total: 2, failed: 1, quarantined: 0 });
    expect(failed.tests?.failures[0]).toMatchObject({
      file: 'b.test.ts',
      name: 'refunds',
      quarantined: false,
    });
    const graph = runGraphSchema.parse(await services.runs.graph(member, run.id));
    expect(graph.stages.map((stage) => stage.nodes.length)).toEqual([1, 4, 1]);
    expect(graph.focus).toBe('unit-1');

    // Shift+R: only the failed and skipped jobs run again, and now they pass.
    const again = await services.runs.rerun(member, run.id, { only: 'failed' });
    expect(again.state).toBe('running');
    expect(again.jobs.find((job) => job.key === 'unit-1')).toMatchObject({
      state: 'ready',
      attempt: 2,
    });
    const retry = await runner.claim(token, { waitSeconds: 0 });
    expect(retry?.key).toBe('unit-1');
    await runner.tests(retry?.jobId ?? '', retry?.jobToken, {
      total: 1,
      passed: 1,
      failed: 0,
      skipped: 0,
      durationMs: 300,
      cases: [{ file: 'b.test.ts', name: 'refunds', outcome: 'passed', durationMs: 300 }],
    });
    await runner.finish(retry?.jobId ?? '', retry?.jobToken, { state: 'passed', at: at() });
    const report = await runner.claim(token, { waitSeconds: 0 });
    expect(report?.key).toBe('report');
    await runner.finish(report?.jobId ?? '', report?.jobToken, { state: 'passed', at: at() });
    expect((await services.runs.get(member, run.id)).state).toBe('passed');

    // The test failed and then passed on the same commit: flaky, and the team may quarantine it.
    const flaky = await services.tests.list(member, 'checkout-api', { state: 'flaky' });
    expect(flaky.items).toEqual([expect.objectContaining({ name: 'refunds', flaky: 'retry' })]);
    const groups = await services.tests.failures(member, {});
    expect(groups.items[0]).toMatchObject({
      occurrences: 1,
      text: 'Error: expected <n> to be <n> at <ip>:<n>',
    });
  });

  it('lets a quarantined test fail without failing the job, and cancels through heartbeats', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { services, users, sql } = harness;
    const member = harness.as(users.member);
    await services.tests.quarantine(member, 'checkout-api', {
      file: 'b.test.ts',
      name: 'refunds',
      reason: 'Known flake',
    });
    await givePipeline(sql, 'checkout-api', {
      checkout: false,
      test: [{ name: 'Unit', run: 'pnpm test' }],
    });
    const run = await services.runs.create(member, {
      application: 'checkout-api',
      commitSha: 'b2d0f1e',
    });
    const { runnerToken } = await services.runner.register({
      poolToken,
      name: 'second',
      version: '0.1.0',
    });
    const job = await services.runner.claim(runnerToken, { waitSeconds: 0 });
    if (!job) throw new Error('expected a job');
    await services.runner.tests(job.jobId, job.jobToken, {
      total: 1,
      passed: 0,
      failed: 1,
      skipped: 0,
      durationMs: 10,
      cases: [
        {
          file: 'b.test.ts',
          name: 'refunds',
          outcome: 'failed',
          durationMs: 10,
          message: 'flaked',
        },
      ],
    });
    await services.runner.finish(job.jobId, job.jobToken, { state: 'failed', at: at() });
    const detail = await services.runs.get(member, run.id);
    expect(detail.state).toBe('passed');
    expect(detail.jobs[0]?.failureSummary).toContain('quarantined');
    expect(detail.tests).toMatchObject({ failed: 1, quarantined: 1 });

    const second = await services.runs.create(member, {
      application: 'checkout-api',
      commitSha: 'b2d0f1e',
    });
    expect(second.number).toBe(run.number + 1);
    const claimed = await services.runner.claim(runnerToken, { waitSeconds: 0 });
    if (!claimed) throw new Error('expected a job');
    await services.runs.cancel(member, second.id, { reason: 'Wrong commit' });
    const beat = await services.runner.heartbeat(runnerToken, {
      state: 'busy',
      jobId: claimed.jobId,
    });
    expect(beat.cancel).toBe(true);
    await services.runner.finish(claimed.jobId, claimed.jobToken, { state: 'cancelled', at: at() });
    expect((await services.runs.get(member, second.id)).state).toBe('cancelled');
  });

  it('refuses a bad pool token, a stranger and a job token used for another job', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { services, users } = harness;
    await expect(
      services.runner.register({ poolToken: 'bpp_not-a-real-token', name: 'x', version: '1' }),
    ).rejects.toThrow('pool token');
    await expect(
      services.runs.create(harness.as(users.outsider), {
        application: 'checkout-api',
        commitSha: 'abcdef1',
      }),
    ).rejects.toThrow();
    await expect(
      services.runner.finish('0199f0a2-7c3e-7d4a-9b1e-2f3a4b5c6d7e', 'bpj_nope', {
        state: 'passed',
        at: at(),
      }),
    ).rejects.toThrow('not valid');
  });
});
