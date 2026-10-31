import type { SqlClient } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_BUILDER_IMAGE } from '../../../../shared/autopilot.ts';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { givePipeline } from '../../testing/execution.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { podsUp } from '../providers/fake/machines.ts';
import { createDefaultProviders } from '../providers/index.ts';
import { createProviderRegistry } from '../providers/registry.ts';
import type { MachineLaunch } from '../providers/runners-contract.ts';
import { createMachinesService, type MachinesService } from './index.ts';

/*
 * GKE Autopilot runner pools end to end against the simulated cloud: the cluster Pipelines
 * creates in the CI project comes up over a sweep, a job queued on the pool gets a pod whose
 * runner registers with the one-time token and passes the job, and the pool returns to zero.
 * Fewest keeps warm room that shrinks while pods are up, and given back when the pool moves
 * off Autopilot; a job whose pod could not be scheduled is refused with a sentence; only a
 * managed connection may create a cluster.
 */

const at = () => new Date().toISOString();
const IMAGE = 'europe-west1-docker.pkg.dev/acme-ci/bemmoly/runner-gke:1.7.0';
const POOL_REF =
  'projects/acme-ci/locations/europe-west1/clusters/bemmoly-runners/namespaces/runners-gke';

async function project(sql: SqlClient, mode: 'managed' | 'attached', externalId: string) {
  const [connection] = await sql<{ id: string }[]>`
    insert into cloud_connections (provider, name, status, layout, config)
    values ('gcp', ${`${externalId} connection`}, 'connected', 'per-environment',
      ${JSON.stringify({ mode, credentials: { kind: 'metadata' } })}::jsonb)
    returning id`;
  const [account] = await sql<{ id: string }[]>`
    insert into cloud_accounts (connection_id, external_id, name, purpose, status, origin)
    values (${connection?.id ?? ''}, ${externalId}, ${externalId}, 'ci', 'ready',
      ${mode === 'managed' ? 'created' : 'attached'})
    returning id`;
  return account?.id ?? '';
}

describe('runner pools on GKE Autopilot', () => {
  let harness: PipelinesHarness | undefined;
  let machines: MachinesService;
  let reason = '';
  let ci = '';
  let nila = '';

  const settings = (account: string, create: boolean) => ({
    account,
    location: 'europe-west1',
    cluster: { name: 'bemmoly-runners', create },
    image: IMAGE,
    cpu: 2,
    memoryGb: 8,
    serviceAccount: 'builder@acme-ci.iam.gserviceaccount.com',
  });
  const pool = async (key: string, min: number, max: number) =>
    harness!.services.capacity.create(harness!.as(harness!.users.admin), {
      key,
      name: key,
      hosting: 'gke-autopilot',
      minRunners: min,
      maxRunners: max,
      autopilot: settings(ci, true),
    });
  const run = async (application: string, poolKey: string) => {
    const { services, users } = harness!;
    await givePipeline(harness!.sql, application, { checkout: false, build: { pool: poolKey } });
    return services.runs.create(harness!.as(users.admin), { application, commitSha: 'c0ffee12' });
  };
  const capacityPool = async (key: string) => {
    const { items } = await harness!.services.capacity.pools(harness!.as(harness!.users.member));
    return items.find((item) => item.key === key);
  };

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    await seedCatalogFixture(harness.sql, harness.users.member);
    ci = await project(harness.sql, 'managed', 'acme-ci');
    nila = await project(harness.sql, 'attached', 'nila-ci');
    const services = harness.services;
    machines = createMachinesService({
      database: harness.sql,
      providers: createProviderRegistry(
        createDefaultProviders({ simulate: true, world: harness.world }),
      ),
      publicUrl: 'https://bemmoly.acme.example',
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

  it('creates the cluster, runs a queued job in its own pod and goes back to zero', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { services, users, world } = harness;
    const created = await pool('gke', 0, 3);
    expect(created.pool.autopilot).toMatchObject({
      namespace: 'runners-gke',
      status: 'preparing',
      builderImage: DEFAULT_BUILDER_IMAGE,
      runners: { running: 0, starting: 0, warm: 0 },
    });
    const queued = await run('checkout-api', 'gke');
    expect(queued.jobs[0]?.waitReason?.text).toBe('Waits for a build machine in gke');

    // The first sweep asks for the cluster; nothing starts while GKE makes it.
    expect(await machines.sweep()).toMatchObject({ started: 0, scaled: 0 });
    expect((await capacityPool('gke'))?.autopilot).toMatchObject({
      status: 'preparing',
      statusDetail: 'Creating Autopilot cluster bemmoly-runners in acme-ci',
    });

    const launches: MachineLaunch[] = [];
    const during: unknown[] = [];
    world.machineDriver = async (launch) => {
      launches.push(launch);
      const registered = await services.runner.register({
        launchToken: launch.launchToken,
        name: 'gke-pod',
        version: '1.7.0',
      });
      during.push({ pods: podsUp(world, POOL_REF).length, pool: await capacityPool('gke') });
      const job = await services.runner.claim(registered.runnerToken, { waitSeconds: 0 });
      if (!job) throw new Error('the pod found no job');
      await services.runner.jobState(job.jobId, job.jobToken, { state: 'running', at: at() });
      await services.runner.finish(job.jobId, job.jobToken, { state: 'passed', at: at() });
    };
    // The second finds it running, prepares the pool and starts the job's pod.
    expect(await machines.sweep()).toMatchObject({ started: 1, scaled: 1 });
    expect(launches[0]).toMatchObject({
      account: { externalId: 'acme-ci' },
      image: IMAGE,
      serviceAccount: 'builder@acme-ci.iam.gserviceaccount.com',
      labels: { pool: 'gke', job: queued.jobs[0]?.id },
      pod: {
        cluster: { location: 'europe-west1', name: 'bemmoly-runners' },
        namespace: 'runners-gke',
        size: { cpu: 2, memoryGb: 8, spot: false },
        stepImages: [],
        builderImage: DEFAULT_BUILDER_IMAGE,
      },
    });
    await Promise.all([...world.machines.values()].map((machine) => machine.done));
    expect(during[0]).toMatchObject({
      pods: 1,
      pool: { autopilot: { status: 'ready', runners: { running: 1, starting: 0 } } },
    });

    const done = await services.runs.get(harness.as(users.admin), queued.id);
    expect(done.state).toBe('passed');
    expect(done.jobs[0]?.machine?.ref).toBe(`${POOL_REF}/jobs/fake-pod-1`);
    await machines.sweep();
    expect(podsUp(world, POOL_REF)).toEqual([]);
    expect(await capacityPool('gke')).toMatchObject({
      busy: 0,
      queued: 0,
      machines: [],
      autopilot: { runners: { running: 0, starting: 0, warm: 0 } },
    });
    world.machineDriver = undefined;
  });

  it('keeps fewest runners of room warm, less the pods already up', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { services, users, world } = harness;
    await services.capacity.update(harness.as(users.admin), 'gke', { minRunners: 2 });
    await machines.sweep();
    expect((await capacityPool('gke'))?.autopilot?.runners.warm).toBe(2);
    expect(world.podPools.get(POOL_REF)?.site.warm).toBe(2);

    await run('payments-worker', 'gke');
    await machines.sweep();
    expect(podsUp(world, POOL_REF)).toHaveLength(1);
    await machines.sweep();
    expect(world.podPools.get(POOL_REF)?.site.warm).toBe(1);
    expect((await capacityPool('gke'))?.autopilot?.runners).toMatchObject({
      starting: 1,
      warm: 1,
    });
  });

  it('gives its warm room back when the pool moves to machines you start', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { services, users, world } = harness;
    await services.capacity.update(harness.as(users.admin), 'gke', { hosting: 'vm' });
    await machines.sweep();
    expect(world.podPools.get(POOL_REF)?.site.warm).toBe(0);
    expect(await capacityPool('gke')).toMatchObject({ hosting: 'vm', autopilot: null });
  });

  it('refuses a job whose pod would hold more step images than a pod may', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { services, users, sql } = harness;
    await pool('gke-wide', 0, 2);
    await machines.sweep();
    await machines.sweep();
    const created = await run('gift-cards', 'gke-wide');
    const steps = Array.from({ length: 9 }, (_, index) => ({
      key: `s${index}`,
      name: `Step ${index}`,
      image: `node:${index + 16}`,
      run: 'node --version',
      uses: null,
      env: {},
      secrets: [],
      locked: false,
      origin: 'application',
    }));
    await sql`update pipeline_jobs set steps_spec = ${JSON.stringify(steps)}::jsonb
      where id = ${created.jobs[0]?.id ?? ''}`;
    await machines.sweep();
    const refused = await services.runs.get(harness.as(users.admin), created.id);
    expect(refused.jobs[0]?.failureSummary).toBe(
      "This job's steps use 9 images and a runner pod holds at most 8. Use fewer images, or run the job on a Cloud Build pool",
    );
  });

  it('creates clusters only on a managed connection and switches a pool to Autopilot', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const admin = harness.as(harness.users.admin);
    const { capacity } = harness.services;
    await capacity.create(admin, {
      key: 'nila-vms',
      name: 'Nila VMs',
      hosting: 'vm',
      maxRunners: 2,
    });
    await expect(capacity.update(admin, 'nila-vms', { hosting: 'gke-autopilot' })).rejects.toThrow(
      /needs its project, cluster, image, size and service account/,
    );
    await expect(
      capacity.update(admin, 'nila-vms', {
        hosting: 'gke-autopilot',
        autopilot: settings(nila, true),
      }),
    ).rejects.toThrow(/does not create clusters there\. Name an Autopilot cluster that exists$/);
    const switched = await capacity.update(admin, 'nila-vms', {
      hosting: 'gke-autopilot',
      autopilot: { ...settings(nila, false), spot: true },
    });
    expect(switched.autopilot).toMatchObject({
      account: { externalId: 'nila-ci' },
      cluster: { name: 'bemmoly-runners', create: false },
      namespace: 'runners-nila-vms',
      spot: true,
    });
    await machines.sweep();
    expect((await capacityPool('nila-vms'))?.autopilot?.status).toBe('ready');
  });
});
