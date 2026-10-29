import type { ConnectionRecord } from './contract.ts';

/*
 * The runners part of the provider model: build machines the cloud starts. A one-job hosting
 * (Cloud Build) launches one machine per job and follows it; a fleet hosting (GKE Autopilot)
 * ensures a pool and scales it.
 */

/** One build machine for one job: what it runs and how it finds Bemmoly. */
export interface MachineLaunch {
  /** The account (project) it runs in, and who Pipelines acts as there. */
  account: { externalId: string; config: Readonly<Record<string, unknown>> };
  region: string;
  /** The runner image, run in one-job mode. */
  image: string;
  /** A neutral size such as "e2-highcpu-8"; null keeps the cloud's default. */
  machineType: string | null;
  /** The identity the machine runs as; null keeps the cloud's default. */
  serviceAccount: string | null;
  /** Bemmoly's address, where the runner calls in. */
  controlPlaneUrl: string;
  /** Registers once, for this job alone; never logged, stored or shown in the machine's args. */
  launchToken: string;
  /** How long the machine may live: the job's timeout plus time to start. */
  timeoutMinutes: number;
  /** Names a person can find the machine by in the cloud's console. */
  labels: { pool: string; job: string; run: string };
}

/** Where a machine is in its life, as the cloud reports it. */
export interface MachineStatus {
  state: 'queued' | 'working' | 'succeeded' | 'failed' | 'cancelled' | 'gone';
  /** The cloud's own reason when it ended badly, in a sentence; null otherwise. */
  detail: string | null;
}

export interface MachineRef {
  account: { externalId: string; config: Readonly<Record<string, unknown>> };
  region: string;
  ref: string;
}

/**
 * Runners the cloud starts. A one-job hosting (Cloud Build) launches one machine per job and
 * follows it; a fleet hosting (GKE Autopilot) ensures a pool and scales it. A provider
 * implements the halves its cloud has.
 */
export interface RunnersPart {
  ensurePool?(
    connection: ConnectionRecord,
    input: { account: string; name: string; machine: string; min: number; max: number },
  ): Promise<{ ref: string }>;
  scale?(connection: ConnectionRecord, input: { ref: string; size: number }): Promise<void>;
  launch?(
    connection: ConnectionRecord,
    input: MachineLaunch,
  ): Promise<{ ref: string; logUrl: string | null }>;
  status?(connection: ConnectionRecord, input: MachineRef): Promise<MachineStatus>;
  cancel?(connection: ConnectionRecord, input: MachineRef): Promise<void>;
}
