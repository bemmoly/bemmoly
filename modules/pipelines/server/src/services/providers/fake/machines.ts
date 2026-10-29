import type { MachineLaunch, MachineStatus, RunnersPart } from '../contract.ts';

/*
 * Build machines in memory. A launched machine is queued, then works by calling the world's
 * driver with its launch (a test's driver registers with the launch token and runs the job
 * through the runner service), and ends succeeded or failed by how the driver returns. With
 * no driver a machine stays queued until a test moves it. Fleet pools record their size.
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

export interface FakeMachinesWorld {
  machines: Map<string, FakeMachine>;
  machineDriver?: FakeMachineDriver;
  /** Fleet pools by ref and the size they were last scaled to. */
  fleets: Map<string, number>;
}

export function createFakeMachines(world: FakeMachinesWorld): RunnersPart {
  const aborts = new Map<string, AbortController>();
  return {
    async ensurePool(_connection, input) {
      const ref = `pools/${input.account}/${input.name}`;
      if (!world.fleets.has(ref)) world.fleets.set(ref, input.min);
      return { ref };
    },
    async scale(_connection, input) {
      world.fleets.set(input.ref, input.size);
    },
    async launch(_connection, input) {
      const ref = `fake-build-${world.machines.size + 1}`;
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
      return { ref, logUrl: `https://fake.cloud/builds/${ref}` };
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
