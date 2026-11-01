import type { ConnectionRecord } from './contract.ts';

/*
 * The runners part of the provider model: build machines the cloud starts, one per job. A
 * machine is a Cloud Build build, or a pod on a Kubernetes cluster (GKE Autopilot) in a pool
 * the provider prepares first: the cluster, the pool's namespace, the identity its pods act
 * as, and room kept warm on the nodes so a job's pod need not wait for a new one.
 */

export interface AccountRef {
  externalId: string;
  config: Readonly<Record<string, unknown>>;
}

/** What each pod asks for: Autopilot bills by the ask, so this is also what a pod costs. */
export interface PodSize {
  cpu: number;
  memoryGb: number;
  /** Spot capacity: cheaper, and the cloud may take it back mid-job. */
  spot: boolean;
}

/** One build machine for one job: what it runs and how it finds Bemmoly. */
export interface MachineLaunch {
  /** The account (project) it runs in, and who Pipelines acts as there. */
  account: AccountRef;
  /** The region, or the cluster's location for a pod. */
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
  /** Set when the machine is a pod in a prepared pool rather than a build. */
  pod?: PodLaunch;
}

export interface PodLaunch {
  cluster: { location: string; name: string };
  namespace: string;
  size: PodSize;
  /** Every image the job's steps run in; each runs as a container beside the runner. */
  stepImages: string[];
  /** Where the job's image builds run; null when it builds none. */
  builderImage: string | null;
}

/** Where a machine is in its life, as the cloud reports it. */
export interface MachineStatus {
  state: 'queued' | 'working' | 'succeeded' | 'failed' | 'cancelled' | 'gone';
  /** The cloud's own reason when it ended badly, in a sentence; null otherwise. */
  detail: string | null;
}

export interface MachineRef {
  account: AccountRef;
  region: string;
  ref: string;
}

/** A pool of pods on a cluster, as Pipelines wants it. */
export interface PodPoolSite {
  account: AccountRef;
  /** The pool's key, which its pods carry as a label. */
  pool: string;
  /** `create` lets the provider create a missing cluster. */
  cluster: { location: string; name: string; create: boolean };
  namespace: string;
  /** The cloud identity the pods act as. */
  serviceAccount: string;
  size: PodSize;
  /** How many pods' worth of room to keep warm on the nodes; 0 keeps none. */
  warm: number;
}

/** How far a pool's preparation got. */
export interface PodPoolState {
  ref: string;
  status: 'preparing' | 'ready' | 'failed';
  /** The cloud's words while it prepares, or what to do when it failed; null when ready. */
  detail: string | null;
  /** Pods' worth of warm room ready now. */
  warm: number;
}

/**
 * Machines the cloud starts for one job each. `launch` starts one and `status` follows it; a
 * pod pool is prepared with `ensurePool` (safe to repeat, and it changes only what differs)
 * before its first pod, and `readPool` counts its warm room. A provider implements the
 * halves its cloud has.
 */
export interface RunnersPart {
  ensurePool?(connection: ConnectionRecord, input: PodPoolSite): Promise<PodPoolState>;
  readPool?(connection: ConnectionRecord, input: MachineRef): Promise<{ warm: number }>;
  launch?(
    connection: ConnectionRecord,
    input: MachineLaunch,
  ): Promise<{ ref: string; logUrl: string | null }>;
  status?(connection: ConnectionRecord, input: MachineRef): Promise<MachineStatus>;
  cancel?(connection: ConnectionRecord, input: MachineRef): Promise<void>;
}
