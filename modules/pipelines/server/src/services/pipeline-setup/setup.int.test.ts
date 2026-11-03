import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { createPool } from '../../testing/execution.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { createReleaseWriter } from '../releases/write.ts';
import { advanceDeploySteps } from '../runs/deploy-steps.ts';

const push = (after: string, branch: string, messages: string[] = []) => ({
  type: 'push' as const,
  repository: 'acme/checkout',
  occurredAt: new Date().toISOString(),
  push: {
    branch,
    before: '0'.repeat(40),
    after,
    defaultBranch: 'main',
    isDefaultBranch: branch === 'main',
    created: false,
    deleted: false,
    forced: false,
    changedFiles: ['src/pay.ts'],
    truncated: false,
    commits: 1,
    pusher: 'priya',
    messages,
  },
});

describe('setting up a pipeline', () => {
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
  });

  afterAll(async () => {
    await harness?.stop();
  });

  it('starts with nothing chosen and templates drawn from the environments that exist', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const member = harness.as(harness.users.member);
    const setup = await harness.services.pipelineSetup.get(member, 'checkout-api');
    expect(setup).toMatchObject({ start: null, store: null, versionScheme: null, triggers: [] });
    const { items } = await harness.services.pipelineSetup.builtInTemplates(member);
    expect(items[0]?.groups.map((group) => group.environment)).toEqual([
      null,
      'dev',
      'staging',
      'prod-asia-south1',
    ]);
  });

  it('makes the pipeline from a template, runs only on Run, then on the trigger added', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { services, sql } = harness;
    const member = harness.as(harness.users.member);
    const saved = await services.pipelineSetup.save(member, 'checkout-api', {
      start: 'template',
      template: 'one-environment',
      store: 'bemmoly',
      versionScheme: 'semver_commits',
    });
    expect(saved).toMatchObject({ start: 'template', triggers: [], pullRequestUrl: null });
    expect(await services.triggers.push(push('a'.repeat(40), 'main'))).toBeNull();

    const run = await services.runs.create(member, {
      application: 'checkout-api',
      ref: 'main',
      commitSha: 'b'.repeat(40),
    });
    const graph = await services.runs.graph(member, run.id);
    expect(graph.groups.map((group) => [group.name, group.environment])).toEqual([
      ['Build', null],
      ['Dev', 'dev'],
    ]);
    const [deploy] = await sql<{ pool_id: string | null; environment_key: string }[]>`
      select pool_id, environment_key from pipeline_jobs where run_id = ${run.id} and kind = 'deploy'`;
    expect(deploy).toEqual({ pool_id: null, environment_key: 'dev' });

    const pipeline = await services.runs.pipeline(member, 'checkout-api');
    await services.pipelineSetup.saveDefinition(member, 'checkout-api', {
      definition: pipeline.definition as never,
      triggers: [{ kind: 'push', branch: 'main' }],
    });
    expect(await services.triggers.push(push('c'.repeat(40), 'feature/x'))).toBeNull();
    const pushed = await services.triggers.push(
      push('d'.repeat(40), 'main', ['fix: keep retries', 'feat: counter offers']),
    );
    expect(pushed).not.toBeNull();
    const [row] = await sql<{ title: string; commit_messages: string[] }[]>`
      select title, commit_messages from pipeline_runs where id = ${pushed ?? ''}`;
    expect(row).toEqual({
      title: 'feat: counter offers',
      commit_messages: ['fix: keep retries', 'feat: counter offers'],
    });
  });

  it('deploys a run step itself, with the version the run makes', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { sql } = harness;
    const [run] = await sql<{ id: string }[]>`
      select id from pipeline_runs where commit_messages <> '{}' order by created_at desc limit 1`;
    const runId = run?.id ?? '';
    await sql`
      update pipeline_jobs set state = 'passed', finished_at = now(),
        image_digests = '{"linux/amd64": "sha256:abc"}'::jsonb
      where run_id = ${runId} and kind <> 'deploy'`;
    await sql`update pipeline_jobs set state = 'ready' where run_id = ${runId} and kind = 'deploy'`;
    const asked: string[] = [];
    const ports = {
      sql,
      writer: createReleaseWriter(),
      promote: async (release: string, to: string) => {
        asked.push(to);
        return { id: release };
      },
    };
    await advanceDeploySteps(ports);
    const [release] = await sql<{ id: string; version: string }[]>`
      select id, version from pipeline_releases where run_id = ${runId}`;
    // The fixture's last version is a semantic one; a "feat" commit bumps its minor.
    expect(release?.version).toMatch(/^\d+\.\d+\.0$/);
    expect(asked).toEqual(['dev']);
    const [env] = await sql<
      { id: string }[]
    >`select id from pipeline_environments where key = 'dev'`;
    await sql`
      insert into pipeline_deployments (release_id, application_id, environment_id, state)
      select ${release?.id ?? ''}, application_id, ${env?.id ?? ''}, 'succeeded'
      from pipeline_releases where id = ${release?.id ?? ''}`;
    const outcomes = await advanceDeploySteps(ports);
    expect(outcomes.map((outcome) => outcome.state)).toEqual(['passed']);
    const states = await sql<{ kind: string; state: string }[]>`
      select kind, state from pipeline_jobs where run_id = ${runId} and kind = 'deploy'`;
    expect(states).toEqual([{ kind: 'deploy', state: 'passed' }]);
    const next = await harness.services.runs.whereNext(harness.as(harness.users.member), runId);
    expect(next.version).toBe(release?.version);
    expect(next.environments.find((e) => e.key === 'dev')?.state).toBe('deployed');
  });
});
