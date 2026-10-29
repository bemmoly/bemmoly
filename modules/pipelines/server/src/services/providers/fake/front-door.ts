import type { DeployRuntime } from '../../../../../shared/common.ts';
import type { DeployTarget } from '../contract.ts';
import type { FrontDoorPart } from '../front-door-contract.ts';
import { keyOf, kubernetesKeyOf, type FakeTargetsWorld } from './targets.ts';

/*
 * A simulated front door per environment. It keeps each host's weighted backends and answers
 * requests through them: a request fails when its share lands on a runtime with no revision
 * running there, or on a revision still starting. Tests send requests between the steps of a
 * move and count what failed, which is the move's whole promise.
 */

export interface FakeBackend {
  /** The fake target the share goes to, as the fake targets key it. */
  key: string;
  runtime: DeployRuntime;
  revision: string | null;
  percent: number;
}

export interface FakeFrontDoor {
  address: string;
  domain: string | null;
  hosts: Map<string, FakeBackend[]>;
}

export interface FakeFrontDoorsWorld extends FakeTargetsWorld {
  /** By environment key. */
  frontDoors: Map<string, FakeFrontDoor>;
  /** Every request sent through a front door, and those that reached nothing running. */
  frontDoorRequests: { sent: number; failed: number };
}

const isCloudRun = (target: DeployTarget) =>
  (target.placement?.runtime ?? 'cloud-run') === 'cloud-run';

export const fakeTargetKey = (target: DeployTarget) =>
  isCloudRun(target) ? keyOf(target) : kubernetesKeyOf(target);

/** Whether a share that lands on this backend is answered by something running. */
function answers(world: FakeFrontDoorsWorld, backend: FakeBackend): boolean {
  const target = world.targets.get(backend.key);
  if (!target) return false;
  const revision =
    backend.revision ?? target.traffic.find((weight) => weight.percent > 0)?.revision ?? null;
  const found = revision ? target.revisions.get(revision) : undefined;
  return Boolean(found && found.warming === 0);
}

/**
 * Sends `count` requests to a host, shared out by weight with the remainders going to the
 * heaviest backends, so the same weights always share the same way. Answers the failures.
 */
export function sendThroughFrontDoor(
  world: FakeFrontDoorsWorld,
  environment: string,
  host: string,
  count: number,
): { sent: number; failed: number } {
  const backends = world.frontDoors.get(environment)?.hosts.get(host) ?? [];
  const total = backends.reduce((sum, backend) => sum + backend.percent, 0);
  let failed = 0;
  let left = count;
  const shares = [...backends].sort((a, b) => b.percent - a.percent);
  shares.forEach((backend, index) => {
    const share =
      index === shares.length - 1 ? left : Math.round((count * backend.percent) / (total || 1));
    left -= share;
    if (share > 0 && !answers(world, backend)) failed += share;
  });
  if (backends.length === 0) failed = count;
  world.frontDoorRequests.sent += count;
  world.frontDoorRequests.failed += failed;
  return { sent: count, failed };
}

export function createFakeFrontDoor(world: FakeFrontDoorsWorld): FrontDoorPart {
  return {
    routesRevisions: ['gke-autopilot', 'gke-standard', 'attached-cluster'],
    untested: [
      'This environment deploys to the simulated cloud, so nothing in it reaches a real one.',
    ],

    async ensure(_connection, door) {
      let found = world.frontDoors.get(door.environment);
      if (!found) {
        found = {
          address: `203.0.113.${10 + world.frontDoors.size}`,
          domain: door.domain,
          hosts: new Map(),
        };
        world.frontDoors.set(door.environment, found);
        world.log.push(`front door ${door.environment} ${found.address}`);
      }
      found.domain = door.domain;
      return { address: found.address, problems: [] };
    },

    async route(_connection, door, input) {
      const found = world.frontDoors.get(door.environment);
      if (!found) throw new Error(`${door.environment} has no front door yet`);
      const total = input.backends.reduce((sum, backend) => sum + backend.percent, 0);
      if (total !== 100) throw new Error(`Weights for ${input.host} add up to ${total}, not 100`);
      const backends = input.backends.map((backend): FakeBackend => {
        const key = fakeTargetKey(backend.target);
        const runtime = backend.target.placement?.runtime ?? 'cloud-run';
        if (!isCloudRun(backend.target)) {
          const revisions = world.targets.get(key)?.revisions;
          if (!backend.revision || !revisions?.has(backend.revision)) {
            throw new Error(`No endpoint group for ${backend.revision ?? key} yet`);
          }
        }
        return { key, runtime, revision: backend.revision, percent: backend.percent };
      });
      found.hosts.set(input.host, backends);
      const weights = backends.map((b) => `${b.revision ?? b.runtime}:${b.percent}`).join(',');
      world.log.push(`route ${input.host}@${door.environment} ${weights}`);
    },

    async leave(target) {
      const key = fakeTargetKey(target);
      world.targets.delete(key);
      world.log.push(`leave ${key}`);
    },

    async remove(_connection, door) {
      world.frontDoors.delete(door.environment);
      world.log.push(`remove front door ${door.environment}`);
    },
  };
}
