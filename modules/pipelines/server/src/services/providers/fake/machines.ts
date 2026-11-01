import type {
  MachineLaunch,
  MachineStatus,
  PodPoolSite,
  PodPoolState,
  RunnersPart,
} from '../runners-contract.ts';

/*
 * Build machines in memory. A launched machine is queued, then works by calling the world's
 * driver with its launch (a test's driver registers with the launch token and runs the job
 * through the runner service), and ends succeeded or failed by how the driver returns. With
 * no driver a machine stays queued until a test moves it.
 *
 * Autopilot pools are simulated too: a cluster Pipelines creates takes one sweep to come up,
 * an attached one is there already, warm room is ready as soon as it is asked for, and a pod
 * per job counts against its pool while it is up, so a pool scales up with its queue and back
 * to zero when its jobs end.
 */

export interface FakeMachine {
  ref: string;
  launch: MachineLaunch;
  state: MachineStatus['state'];
  detail: string | null;
  /** Settles when the driver is done with the machine. */
  done: Promise<void>;
}

/** Plays the runner inside a machine; resolving means the machine's process exited cleanly. */
export type FakeMachineDriver = (launch: MachineLaunch, signal: AbortSignal) => Promise<void>;

export interface FakePodPool {
  site: PodPoolSite;
  state: PodPoolState;
}

export interface FakeMachinesWorld {
  machines: Map<string, FakeMachine>;
  machineDriver?: FakeMachineDriver;
  /** Autopilot clusters by path, and whether each is up yet. */
  podClusters: Map<string, 'creating' | 'running'>;
  /** Autopilot pools by ref, as last prepared. */
  podPools: Map<string, FakePodPool>;
}

const UP = new Set<MachineStatus['state']>(['queued', 'working']);

/** The pods up now in one pool's namespace on one cluster. */
export function podsUp(world: FakeMachinesWorld, ref: string): FakeMachine[] {
  return [...world.machines.values()].filter(
    (machine) => machine.ref.startsWith(`${ref}/jobs/`) && UP.has(machine.state),
  );
}

const clusterPath = (project: string, location: string, name: string) =>
  `projects/${project}/locations/${location}/clusters/${name}`;

function preparePool(world: FakeMachinesWorld, site: PodPoolSite): PodPoolState {
  const path = clusterPath(site.account.externalId, site.cluster.location, site.cluster.name);
  const ref = `${path}/namespaces/${site.namespace}`;
  let cluster = world.podClusters.get(path);
  if (!cluster) {
    cluster = site.cluster.create ? 'creating' : 'running';
    world.podClusters.set(path, cluster);
    if (cluster === 'creating') {
      return {
        ref,
        status: 'preparing',
        detail: `Creating Autopilot cluster ${site.cluster.name} in ${site.account.externalId}`,
        warm: 0,
      };
    }
  }
  world.podClusters.set(path, 'running');
  const state: PodPoolState = { ref, status: 'ready', detail: null, warm: site.warm };
  world.podPools.set(ref, { site, state });
  return state;
}

export function createFakeMachines(world: FakeMachinesWorld): RunnersPart {
  const aborts = new Map<string, AbortController>();
  return {
    async ensurePool(_connection, input) {
      return preparePool(world, input);
    },
    async readPool(_connection, input) {
      return { warm: world.podPools.get(input.ref)?.state.warm ?? 0 };
    },
    async launch(_connection, input) {
      const pod = input.pod;
      const ref = pod
        ? `${clusterPath(input.account.externalId, pod.cluster.location, pod.cluster.name)}/namespaces/${pod.namespace}/jobs/fake-pod-${world.machines.size + 1}`
        : `fake-build-${world.machines.size + 1}`;
      const abort = new AbortController();
      aborts.set(ref, abort);
      const machine: FakeMachine = {
        ref,
        launch: input,
        state: 'queued',
        detail: null,
        done: Promise.resolve(),
      };
      const driver = world.machineDriver;
      if (driver) {
        machine.done = (async () => {
          await Promise.resolve();
          if (machine.state !== 'queued') return;
          machine.state = 'working';
          try {
            await driver(input, abort.signal);
            if (machine.state === 'working') machine.state = 'succeeded';
          } catch (error) {
            if (machine.state !== 'working') return;
            machine.state = 'failed';
            machine.detail = (error as Error).message;
          }
        })();
      }
      world.machines.set(ref, machine);
      return { ref, logUrl: `https://fake.cloud/${pod ? 'pods' : 'builds'}/${ref}` };
    },
    async status(_connection, input) {
      const machine = world.machines.get(input.ref);
      if (!machine) return { state: 'gone', detail: 'The simulated cloud has no such machine' };
      return { state: machine.state, detail: machine.detail };
    },
    async cancel(_connection, input) {
      const machine = world.machines.get(input.ref);
      if (!machine || (machine.state !== 'queued' && machine.state !== 'working')) return;
      machine.state = 'cancelled';
      aborts.get(input.ref)?.abort();
    },
  };
}
