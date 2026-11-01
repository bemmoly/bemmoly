import { describe, expect, it } from 'vitest';
import type { DeployTarget } from '../contract.ts';
import { sendThroughFrontDoor } from './front-door.ts';
import { createFakeProvider, createFakeWorld } from './index.ts';

/* The simulated front door counts what a careless move would lose. */

const cloudRun: DeployTarget = {
  connection: {
    id: 'c',
    provider: 'gcp',
    name: 'Fake',
    layout: 'per-environment',
    boundaryRef: null,
    config: {},
  },
  environment: { id: 'e', key: 'prod', class: 'prod', region: 'asia-south1' },
  account: { externalId: 'acme-prod', name: 'acme-prod' },
  application: { id: 'a', key: 'shop', runtime: 'container-service' },
};

const gke: DeployTarget = {
  ...cloudRun,
  placement: {
    runtime: 'gke-autopilot',
    namespace: 'web',
    cluster: {
      id: 'k',
      origin: 'created',
      mode: 'autopilot',
      projectId: 'acme-prod',
      location: 'asia-south1',
      name: 'bemmoly-prod',
      gateway: null,
    },
  },
};

const release = {
  id: '00000000-0000-7000-8000-000000000001',
  version: 'v1',
  commitSha: 'a1c9e3f',
  imageRepository: null,
  imageDigests: {},
  resolvedConfig: {},
};

const door = {
  environment: 'prod',
  account: { externalId: 'acme-prod' },
  region: 'asia-south1',
  domain: null,
};

describe('the simulated front door', () => {
  it('fails the share sent to a revision still starting, and nothing else', async () => {
    const world = createFakeWorld();
    const provider = createFakeProvider(world);
    const gkeTargets = provider.runtimes?.['gke-autopilot']?.targets;
    const part = provider.frontDoor;
    if (!gkeTargets || !part || !provider.targets) throw new Error('fake parts missing');
    const stable = await provider.targets.deploy(cloudRun, release);
    await provider.targets.shift(cloudRun, { ...stable, percent: 100, stable: null });
    world.revisionWarmup = 1;
    const next = await gkeTargets.deploy(gke, release);
    await gkeTargets.shift(gke, { ...next, percent: 100, stable: null });
    expect((await part.ensure(cloudRun.connection, door, ['shop'])).address).toBe('203.0.113.10');
    await part.route(cloudRun.connection, door, {
      application: 'shop',
      host: 'shop',
      backends: [
        { target: gke, revision: next.revision, percent: 10 },
        { target: cloudRun, revision: null, percent: 90 },
      ],
    });
    expect(sendThroughFrontDoor(world, 'prod', 'shop', 100)).toEqual({ sent: 100, failed: 10 });
    expect(await gkeTargets.health(gke, next.revision)).toBe('unknown');
    expect(sendThroughFrontDoor(world, 'prod', 'shop', 100)).toEqual({ sent: 100, failed: 0 });
    await part.leave(cloudRun);
    expect(sendThroughFrontDoor(world, 'prod', 'shop', 100)).toEqual({ sent: 100, failed: 90 });
    expect(world.frontDoorRequests).toEqual({ sent: 300, failed: 100 });
  });

  it('refuses weights that do not add up, and a GKE share with no revision there', async () => {
    const provider = createFakeProvider();
    const part = provider.frontDoor;
    if (!part) throw new Error('fake front door missing');
    await part.ensure(cloudRun.connection, door, []);
    const route = (backends: Parameters<typeof part.route>[2]['backends']) =>
      part.route(cloudRun.connection, door, { application: 'shop', host: 'shop', backends });
    await expect(route([{ target: cloudRun, revision: null, percent: 90 }])).rejects.toThrow(
      /add up to 90/,
    );
    await expect(route([{ target: gke, revision: 'shop-v9-1', percent: 100 }])).rejects.toThrow(
      /No endpoint group/,
    );
  });
});
