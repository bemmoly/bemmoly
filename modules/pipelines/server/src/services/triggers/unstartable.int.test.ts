import type { CodeCheckReport, RequestContext } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { createPool, givePipeline } from '../../testing/execution.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import type { PipelinesCodeHosts } from '../code/hosts.ts';
import { reportRunCheck } from '../runs/checks.ts';
import { createRunHooks } from '../runs/hooks.ts';
import { createTriggersService } from './index.ts';

const push = (repository: string, after: string, files: string[]) => ({
  type: 'push' as const,
  repository,
  occurredAt: new Date().toISOString(),
  push: {
    branch: 'main',
    before: '0'.repeat(40),
    after,
    defaultBranch: 'main',
    isDefaultBranch: true,
    created: false,
    deleted: false,
    forced: false,
    changedFiles: files,
    truncated: false,
    commits: 1,
    pusher: 'priya',
  },
});

const GOOD_FILE = `name: lake-batch
group: lake
pipeline:
  checkout: false
  test:
    - name: Unit
      run: pytest
`;

describe('a push whose pipeline cannot start', () => {
  let harness: PipelinesHarness | undefined;
  let reason = '';
  let system: RequestContext;
  const reports: CodeCheckReport[] = [];
  const sent: Array<{ name: string; payload: Record<string, unknown> }> = [];
  const hosts = {
    client: async () => ({
      reportCheck: async (report: CodeCheckReport) => {
        reports.push(report);
        return { externalId: `check-${reports.length}` };
      },
    }),
  } as unknown as PipelinesCodeHosts;

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    await seedCatalogFixture(harness.sql, harness.users.member);
    await createPool(harness.sql, 'linux-x64');
    system = {
      ...harness.as(harness.users.admin),
      actor: { kind: 'system', id: 'code-host:test' },
    };
  });

  afterAll(async () => {
    await harness?.stop();
  });

  const triggers = () =>
    createTriggersService({
      database: harness?.sql,
      access: harness?.services.access,
      hooks: createRunHooks(),
      code: hosts,
      async sendJob(name, payload) {
        sent.push({ name, payload });
        return null;
      },
    });

  it('fails the run with the reason when the pipeline does not resolve, and reports the check', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    await givePipeline(harness.sql, 'checkout-api', { extends: 'acme/missing@1' });
    await harness.sql`update pipeline_applications set path = 'services/api' where key = 'checkout-api'`;
    const event = push('acme/checkout', 'a'.repeat(40), ['services/api/pay.ts']);
    const id = await triggers().push(event);
    expect(id).not.toBeNull();
    // A redelivered event records nothing new.
    expect(await triggers().push(event)).toBe(id);

    const member = harness.as(harness.users.member);
    const run = await harness.services.runs.get(member, id ?? '');
    expect(run).toMatchObject({
      state: 'failed',
      jobs: [],
      applications: [expect.objectContaining({ key: 'checkout-api' })],
      failureReason:
        'Template acme/missing@1 is not available. Sync the template repository or use a version that exists.',
    });
    const listed = await harness.services.runs.list(member, { limit: 50 });
    expect(listed.items.find((item) => item.id === id)?.failureReason).toBe(run.failureReason);
    await expect(harness.services.runs.rerun(member, id ?? '', { only: 'failed' })).rejects.toThrow(
      /before any job started/,
    );

    expect(sent).toEqual([{ name: 'pipelines.report-check', payload: { runId: id } }]);
    expect(await reportRunCheck(harness.sql, hosts, id ?? '')).toBe(true);
    expect(reports.at(-1)).toMatchObject({
      repository: 'acme/checkout',
      headSha: 'a'.repeat(40),
      name: 'Bemmoly · checkout-api · Pipeline',
      status: 'completed',
      conclusion: 'failure',
      summary: run.failureReason,
    });
  });

  it('fails a pull request run the same way', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const id = await triggers().pullRequest({
      type: 'pull_request',
      repository: 'acme/checkout',
      action: 'opened',
      number: 7,
      title: 'Retry UPI collect',
      url: 'https://example.test/pr/7',
      headSha: 'b'.repeat(40),
      headRef: 'feat/upi',
      baseRef: 'main',
      fromFork: false,
      draft: false,
      merged: false,
      author: 'priya',
      occurredAt: new Date().toISOString(),
    });
    const [run] = await harness.sql<{ state: string; failure_reason: string; trigger: string }[]>`
      select state, failure_reason, trigger from pipeline_runs where id = ${id ?? ''}`;
    expect(run).toMatchObject({ state: 'failed', trigger: 'pull_request' });
    expect(run?.failure_reason).toContain('acme/missing@1');
  });

  it("says it couldn't read the application.yaml a push broke, instead of running the old pipeline", async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const writes = harness.services.catalogWrites;
    const path = 'batch/.bemmoly/application.yaml';
    const repository = { fullName: 'acme/data', defaultBranch: 'main' };
    await writes.applyApplicationFiles(system, {
      repository,
      commitSha: 'c'.repeat(40),
      files: [{ path, content: GOOD_FILE }],
    });
    await writes.applyApplicationFiles(system, {
      repository,
      commitSha: 'd'.repeat(40),
      files: [{ path, content: `${GOOD_FILE}tier: [\n` }],
    });
    const id = await triggers().push(push('acme/data', 'd'.repeat(40), [path]));
    const run = await harness.services.runs.get(harness.as(harness.users.member), id ?? '');
    expect(run.state).toBe('failed');
    expect(run.jobs).toEqual([]);
    expect(run.applications.map((app) => app.key)).toEqual(['lake-batch']);
    expect(run.failureReason).toMatch(
      /^Couldn't read batch\/\.bemmoly\/application\.yaml: The YAML does not parse: .+\nFix the file and push again\.$/,
    );

    // A file that names no group never became an application; the push still says why.
    const broken = 'stream/.bemmoly/application.yaml';
    await writes.applyApplicationFiles(system, {
      repository,
      commitSha: 'e'.repeat(40),
      files: [{ path: broken, content: 'name: lake-stream\ngroup: nowhere\n' }],
    });
    const lone = await triggers().push(push('acme/data', 'e'.repeat(40), [broken]));
    const orphan = await harness.services.runs.get(harness.as(harness.users.member), lone ?? '');
    expect(orphan).toMatchObject({ state: 'failed', applications: [] });
    expect(orphan.failureReason).toContain(`Couldn't read ${broken}: No group called "nowhere"`);

    // A warning (an owner that names no team) still runs the pipeline.
    const warned = await writes.applyApplicationFiles(system, {
      repository,
      commitSha: 'f'.repeat(40),
      files: [
        { path, content: GOOD_FILE.replace('group: lake', 'group: lake\nowner: team/ghosts') },
      ],
    });
    expect(warned.problems).toEqual([expect.objectContaining({ applied: true })]);
    const ran = await triggers().push(push('acme/data', 'f'.repeat(40), [path]));
    const [state] = await harness.sql<{ state: string }[]>`
      select state from pipeline_runs where id = ${ran ?? ''}`;
    expect(state?.state).toBe('queued');
  });
});
