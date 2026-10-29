import type { CloudResourceKind } from '../../../../shared/clouds.ts';
import type { ClusterRecord, Placement } from './cluster-contract.ts';
import type { ConnectionRecord, DeployVariable, ReleaseArtifact } from './contract.ts';

/*
 * The export half of the provider model: what Pipelines recorded about one connection, in
 * neutral words, turned into files a company can run without Pipelines (Terraform and Helm on
 * Google Cloud). `files` is pure, so the same records always give the same files; `read`
 * fills in the few facts the records lack, such as a project's number.
 */

export interface ExportAccount {
  externalId: string;
  name: string;
  origin: 'created' | 'attached';
  purpose: 'workload' | 'ci' | 'control';
  /** Who deploys and runs there, for accounts attached as they were. */
  config: Readonly<Record<string, unknown>>;
}

/** One landing zone resource that exists: its kind, name, account and spec as declared. */
export interface ExportResource {
  kind: CloudResourceKind;
  name: string;
  account: string;
  spec: Readonly<Record<string, unknown>>;
}

/** The release serving one application in one environment, as its last deploy left it. */
export interface ExportService {
  application: string;
  environment: { key: string; region: string | null };
  account: { externalId: string; config: Readonly<Record<string, unknown>> };
  placement: Placement;
  release: ReleaseArtifact;
  /** The revision taking its traffic. */
  revision: string;
  /** The whole environment it runs with: plain values and secrets by reference. */
  variables: readonly DeployVariable[];
  /** A deploy since did not land (a canary moving, a failure or a roll back). */
  moving: boolean;
}

export interface ExportCluster extends ClusterRecord {
  environment: string;
}

export interface ExportSecret {
  account: string;
  name: string;
}

/** A pool that starts one build machine per job, and how it starts them. */
export type ExportPool =
  | {
      key: string;
      kind: 'cloud-build';
      account: string;
      region: string;
      image: string;
      machine: string;
      serviceAccount: string;
    }
  | {
      key: string;
      kind: 'gke-autopilot';
      account: string;
      location: string;
      /** `create`: Pipelines made the cluster when it was missing. */
      cluster: { name: string; create: boolean };
      namespace: string;
      image: string;
      builderImage: string;
      cpu: number;
      memoryGb: number;
      spot: boolean;
      serviceAccount: string;
    };

/** One host on a front door: where its traffic goes, by runtime and revision. */
export interface ExportFrontDoorHost {
  application: string;
  /** The catalog group's namespace, where its GKE revisions run. */
  namespace: string;
  host: string;
  backends: ReadonlyArray<{ runtime: string; revision: string | null; percent: number }>;
  /** A move between runtimes or a canary is under way, so the weights are in flight. */
  moving: boolean;
}

/** An environment's front door in one account (project): its address and its hosts. */
export interface ExportFrontDoor {
  environment: string;
  account: string;
  region: string | null;
  domain: string | null;
  hosts: readonly ExportFrontDoorHost[];
}

export interface ExportRecords {
  connection: ConnectionRecord & { principal: string | null };
  accounts: readonly ExportAccount[];
  resources: readonly ExportResource[];
  services: readonly ExportService[];
  clusters: readonly ExportCluster[];
  secrets: readonly ExportSecret[];
  pools: readonly ExportPool[];
  frontDoors: readonly ExportFrontDoor[];
  /** What the records could not export, one sentence each. */
  leftOut: readonly string[];
}

/** Facts read from the cloud now; anything missing is a value a person fills in. */
export interface ExportFacts {
  accounts: Readonly<Record<string, { number: string | null; parent: string | null }>>;
  /** The cloud's own name for each account's budget, by account. */
  budgets: Readonly<Record<string, string>>;
  /** The zonal endpoint groups GKE made for a front door's backend, by backend name. */
  groups?: Readonly<Record<string, readonly string[]>>;
  problems: readonly string[];
}

export interface ExportFile {
  /** "terraform/main.tf", relative to the connection's directory. */
  path: string;
  content: string;
}

/** One connection's files, with what stayed out and what a person must fill in or decide. */
export interface ExportBundle {
  files: ExportFile[];
  leftOut: string[];
  toFill: string[];
}

export interface ExportPart {
  read?(connection: ConnectionRecord, records: ExportRecords): Promise<ExportFacts>;
  files(records: ExportRecords, facts: ExportFacts): ExportBundle;
}

export const NO_FACTS: ExportFacts = { accounts: {}, budgets: {}, problems: [] };
