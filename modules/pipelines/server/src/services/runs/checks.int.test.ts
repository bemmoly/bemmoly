import type { CodeCheckReport } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PipelinesCodeHosts } from '../code/hosts.ts';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { createPool, givePipeline } from '../../testing/execution.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { reportJobCheck } from './checks.ts';

describe('check runs on the code host', () => {
  let harness: PipelinesHarness | undefined;
  let reason = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    await seedCatalogFixture(harness.sql, harness.users.member);
    await createPool(harness.sql, 'linux-x64');
    await givePipeline(harness.sql, 'checkout-api', {
      checkout: false,
      test: [{ name: 'Unit', run: 'x' }],
    });
  });

  afterAll(async () => {
    await harness?.stop();
  });

  it('creates a check for a job, then updates the same one as its state changes', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const reports: CodeCheckReport[] = [];
    const hosts = {
      client: async () => ({
        reportCheck: async (report: CodeCheckReport) => {
          reports.push(report);
          return { externalId: 'check-1' };
        },
      }),
    } as unknown as PipelinesCodeHosts;
    const run = await harness.services.runs.create(harness.as(harness.users.member), {
      application: 'checkout-api',
      commitSha: 'abc1234def',
    });
    const jobId = run.jobs[0]?.id ?? '';
    await reportJobCheck(harness.sql, hosts, jobId, 'https://bemmoly.example.com');
    await harness.sql`update pipeline_jobs set state = 'failed', failure_summary = 'Tests failed' where id = ${jobId}`;
    await reportJobCheck(harness.sql, hosts, jobId);
    expect(reports).toEqual([
      expect.objectContaining({
        repository: 'acme/checkout',
        headSha: 'abc1234def',
        name: 'Bemmoly · checkout-api · Unit',
        status: 'queued',
        detailsUrl: `https://bemmoly.example.com/pipelines/jobs/${jobId}`,
      }),
      expect.objectContaining({
        status: 'completed',
        conclusion: 'failure',
        externalId: 'check-1',
        summary: 'Tests failed',
      }),
    ]);
    expect(await reportJobCheck(harness.sql, undefined, jobId)).toBe(false);
  });
});
