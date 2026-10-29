import type { SqlClient } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { givePipeline } from '../../testing/execution.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import type { MachineLaunch } from '../providers/contract.ts';
import { createDefaultProviders } from '../providers/index.ts';
import { createProviderRegistry } from '../providers/registry.ts';
import { createMachinesService, type MachinesService } from './index.ts';

/*
 * Build machines end to end against the simulated cloud: a job queued on a Cloud Build pool
 * gets a build, whose runner registers with the one-time token, runs the job to passed and
 * leaves the pool at zero; the pool's most and the turns between pools hold; a build that
 * dies fails its job with a sentence; cancelling a run stops its build; forks never start one.
 */

const at = () => new Date().toISOString();
const IMAGE = 'europe-west1-docker.pkg.dev/nila-ci/bemmoly/runner:1.7.0';

async function attachedProject(sql: SqlClient): Promise<string> {
  const [connection] = await sql<{ id: string }[]>`
    insert into cloud_connections (provider, name, status, layout, config)
    values ('gcp', 'Nila Google Cloud', 'connected', 'per-environment',
      ${JSON.stringify({ mode: 'attached', credentials: { kind: 'metadata' } })}::jsonb)
    returning id`;
  const [account] = await sql<{ id: string }[]>`
    insert into cloud_accounts (connection_id, external_id, name, purpose, status, origin)
    values (${connection?.id ?? ''}, 'nila-ci', 'Nila CI', 'ci', 'ready', 'attached')
    returning id`;
  return account?.id ?? '';
}

describe('build machines on a Cloud Build pool', () => {
  let harness: PipelinesHarness | undefined;
  let machines: MachinesService;
  let reason = '';
  let account = '';

  const pool = async (key: string, max: number) => {
    const { services, users } = harness!;
    await services.capacity.create(harness!.as(users.admin), {
      key,
      name: key,
      hosting: 'cloud-build',
      maxRunners: max,
      cloudBuild: {
        account,
        region: 'europe-west1',
        image: IMAGE,
        machine: 'e2-highcpu-8',
        serviceAccount: 'builder@nila-ci.iam.gserviceaccount.com',
      },
    });
  };
  const run = async (application: string, poolKey: string) => {
    const { services, users } = harness!;
    await givePipeline(harness!.sql, application, { checkout: false, build: { pool: poolKey } });
    return services.runs.create(harness!.as(users.admin), { application, commitSha: 'c0ffee12' });
  };
  const capacityPool = async (key: string) => {
    const { services, users } = harness!;
    const { items } = await services.capacity.pools(harness!.as(users.member));
    return items.find((item) => item.key === key);
  };
  const settled = () =>
    Promise.all([...harness!.world.machines.values()].map((machine) => machine.done));

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    await seedCatalogFixture(harness.sql, harness.users.member);
    account = await attachedProject(harness.sql);
    const services = harness.services;
    machines = createMachinesService({
      database: harness.sql,
      providers: createProviderRegistry(
        createDefaultProviders({ simulate: true, world: harness.world }),
      ),
      publicUrl: 'https://bemmoly.nila.example',
      announce: async (outcomes) => {
        for (const outcome of outcomes) {
          if (outcome.finished) await services.hooks.emitFinished(outcome);
        }
      },
    });
  });

  afterAll(async () => {
    await harness?.services.wakeups.stop();
    await harness?.stop();
  });

  it('starts a build for a queued job, runs it to passed and goes back to zero', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { services, users, world } = harness;
    await pool('cloud-build', 4);
    const launches: MachineLaunch[] = [];
    world.machineDriver = async (launch) => {
      launches.push(launch);
      const runner = services.runner;
      const registered = await runner.register({
        launchToken: launch.launchToken,
        name: 'cloud-build',
        version: '1.7.0',
      });
      // The token registers once; a second machine holding it is refused.
      await expect(
        runner.register({ launchToken: launch.launchToken, name: 'again', version: '1.7.0' }),
      ).rejects.toThrow(/used already/);
      const job = await runner.claim(registered.runnerToken, { waitSeconds: 0 });
      if (!job) throw new Error('the machine found no job');
      await runner.jobState(job.jobId, job.jobToken, { state: 'running', at: at() });
      await runner.finish(job.jobId, job.jobToken, { state: 'passed', at: at() });
      // Retired with its job: the runner token stops working.
      await expect(runner.heartbeat(registered.runnerToken, { state: 'idle' })).rejects.toThrow(
        /not registered/,
      );
    };
    const created = await run('checkout-api', 'cloud-build');
    expect(created.jobs[0]?.waitReason?.text).toBe('Waits for a build machine in cloud-build');

    expect(await machines.sweep()).toMatchObject({ started: 1 });
    expect(launches[0]).toMatchObject({
      account: { externalId: 'nila-ci' },
      region: 'europe-west1',
      image: IMAGE,
      machineType: 'e2-highcpu-8',
      serviceAccount: 'builder@nila-ci.iam.gserviceaccount.com',
      controlPlaneUrl: 'https://bemmoly.nila.example',
      labels: { pool: 'cloud-build', job: created.jobs[0]?.id },
    });
    await settled();

    const done = await services.runs.get(harness.as(users.admin), created.id);
    expect(done.state).toBe('passed');
    expect(done.jobs[0]?.machine).toMatchObject({
      state: 'finished',
      ref: 'fake-build-1',
      logUrl: 'https://fake.cloud/builds/fake-build-1',
    });
    expect(await machines.sweep()).toEqual({ followed: 0, started: 0, scaled: 0 });
    expect(await capacityPool('cloud-build')).toMatchObject({ busy: 0, queued: 0, machines: [] });
    world.machineDriver = undefined;
  });

  it('keeps to the most each pool may start and takes turns between pools', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    await pool('cb-busy', 2);
    await pool('cb-quiet', 2);
    for (const application of ['payments-worker', 'gift-cards', 'pricing-svc']) {
      await run(application, 'cb-busy');
    }
    const quiet = await run('lake-ingest', 'cb-quiet');
    expect(await machines.sweep()).toMatchObject({ started: 3 });
    const busy = await capacityPool('cb-busy');
    expect(busy?.machines).toHaveLength(2);
    expect(busy).toMatchObject({ queued: 3, atLimit: true });
    expect((await capacityPool('cb-quiet'))?.machines.map((machine) => machine.jobId)).toEqual([
      quiet.jobs[0]?.id,
    ]);
    // A second server sweeping at the same moment starts nothing more.
    const [first, second] = await Promise.all([machines.sweep(), machines.sweep()]);
    expect((first?.started ?? 0) + (second?.started ?? 0)).toBe(0);
  });

  it('fails a job whose build died before reporting, and stops the build of a cancelled run', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { services, users, world, sql } = harness;
    const member = harness.as(users.admin);
    const [dying, cancelling] = [...world.machines.values()].filter(
      (machine) => machine.launch.labels.pool === 'cb-busy',
    );
    if (!dying || !cancelling) throw new Error('expected two builds in cb-busy');
    dying.state = 'failed';
    dying.detail = 'Build step failure: build step 0 failed: exit status 137';
    await sql`update pipeline_runner_launches set checked_at = null`;
    await services.runs.cancel(member, cancelling.launch.labels.run, {});
    await machines.sweep();

    const died = await services.runs.get(member, dying.launch.labels.run);
    expect(died.state).toBe('failed');
    expect(died.jobs[0]?.failureSummary).toBe(
      "The build machine stopped before the job reported back: Build step failure: build step 0 failed: exit status 137. Open the machine's log for the reason",
    );
    expect(cancelling.state).toBe('cancelled');
    // A freed place went to the job still waiting in that pool.
    const left = (await capacityPool('cb-busy'))?.machines ?? [];
    expect(left.map((machine) => machine.runId)).toHaveLength(1);
    expect([dying.launch.labels.run, cancelling.launch.labels.run]).not.toContain(left[0]?.runId);
  });

  it('never starts a build for a pull request from a fork', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { services, users, sql } = harness;
    await pool('cb-forks', 2);
    const created = await run('checkout-api', 'cb-forks');
    await sql`update pipeline_runs set from_fork = true where id = ${created.id}`;
    await machines.sweep({ pools: [created.jobs[0]?.pool?.id ?? ''] });
    const refused = await services.runs.get(harness.as(users.admin), created.id);
    expect(refused.jobs[0]?.state).toBe('failed');
    expect(refused.jobs[0]?.failureSummary).toMatch(/^Pools whose machines Pipelines starts do not run pull requests from forks/);
    expect((await capacityPool('cb-forks'))?.machines).toEqual([]);
  });
});
