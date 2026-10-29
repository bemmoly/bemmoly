import type { CloudResourceKind, Layout } from '../../../../shared/clouds.ts';
import type { ClustersPart, Placement, RuntimeParts } from './cluster-contract.ts';
import type {
  DeployRuntime,
  EnvironmentClass,
  Health,
  Provider,
  Runtime,
} from '../../../../shared/common.ts';
import type { BillingHeadroom } from './org-contract.ts';
import type { FrontDoorPart } from './front-door-contract.ts';
import type { RunnersPart } from './runners-contract.ts';

/*
 * The provider model (architecture §14). Everything cloud-specific sits behind these
 * interfaces; the rest of Pipelines speaks in neutral words (account, revision, weight) and
 * never sees a vendor shape. A provider implements the parts its cloud supports and leaves
 * the others out; what it leaves out is reported as a capability flag, so a screen can say
 * "Coming soon" instead of failing. Every implementation passes the conformance kit in
 * server/src/testing/provider-conformance.ts.
 */

export const PROVIDER_PARTS = [
  'connection',
  'org',
  'landingZone',
  'registry',
  'secrets',
  'targets',
  'metrics',
  'runners',
  'access',
  'cost',
] as const;

export type { MachineLaunch, MachineRef, MachineStatus, RunnersPart } from './runners-contract.ts';
export { ApplyStopped, type BillingHeadroom } from './org-contract.ts';

export type ProviderPart = (typeof PROVIDER_PARTS)[number];
export type PartAvailability = 'available' | 'coming_soon' | 'unsupported';

/** One cloud connection as the provider sees it: its stored config, never a secret value. */
export interface ConnectionRecord {
  id: string;
  provider: Provider;
  name: string;
  layout: Layout;
  boundaryRef: string | null;
  config: Readonly<Record<string, unknown>>;
}

/** Where one application runs in one environment: what every deploy call is about. */
export interface DeployTarget {
  connection: ConnectionRecord;
  environment: { id: string; key: string; class: EnvironmentClass; region: string | null };
  /**
   * The project, account or namespace; null for providers that have none (local). Its config
   * says who to act as there, for projects attached as they already were.
   */
  account: { externalId: string; name: string; config?: Readonly<Record<string, unknown>> } | null;
  application: { id: string; key: string; runtime: Runtime };
  /** Which runtime it runs on there, and the cluster when that runtime needs one. */
  placement?: Placement;
}

/** What a target needs to know about a release: the image by digest and its config. */
export interface ReleaseArtifact {
  id: string;
  version: string;
  commitSha: string;
  imageRepository: string | null;
  imageDigests: Readonly<Record<string, string>>;
  resolvedConfig: Readonly<Record<string, unknown>>;
}

/**
 * One variable a revision runs with. A plain one carries its value; a secret names where it
 * lives and the version to pin, so the revision reads exactly that version at start.
 */
export type DeployVariable =
  | { name: string; kind: 'plain'; value: string }
  | { name: string; kind: 'secret'; account: string; secret: string; version: string };

export interface RevisionWeight {
  revision: string;
  percent: number;
}

export interface TargetDescription {
  /** Revisions taking traffic now, heaviest first; weights live in the provider (§19). */
  traffic: RevisionWeight[];
  /** Where a person can reach it: a tagged URL, a load balancer, a local port. */
  url: string | null;
}

/** Deploy kinds of §12: deploy creates a revision without traffic, shift moves weight. */
export interface TargetsPart {
  kinds: readonly Runtime[];
  /**
   * `variables` are the revision's whole environment: names not in it are not set. The
   * provider grants whoever the revision runs as read access to each secret it names.
   */
  deploy(
    target: DeployTarget,
    release: ReleaseArtifact,
    variables?: readonly DeployVariable[],
  ): Promise<{ revision: string }>;
  /** `percent` of traffic to `revision`, the rest to `stable` (or nothing when null). */
  shift(
    target: DeployTarget,
    input: { revision: string; percent: number; stable: string | null },
  ): Promise<void>;
  /** Every request back to `previousRevision`, at once. */
  rollback(target: DeployTarget, previousRevision: string): Promise<void>;
  health(target: DeployTarget, revision: string): Promise<Health>;
  describe(target: DeployTarget): Promise<TargetDescription>;
  /** Removes a revision that takes no traffic; providers that keep revisions may no-op. */
  retire(target: DeployTarget, revision: string): Promise<void>;
}

export type MetricName = 'error_rate' | 'latency_p95';

export interface MetricWindow {
  from: Date;
  to: Date;
}

/** One revision's series over a window; `value` is the window's aggregate. */
export interface RevisionMetric {
  value: number | null;
  /** Requests in the window, so analysis can wait for enough of them. */
  requests: number;
  points: Array<[Date, number]>;
}

export interface MetricsPart {
  /** Null when the provider has no data source for this target at all. */
  revision(
    target: DeployTarget,
    revision: string,
    metric: MetricName,
    window: MetricWindow,
  ): Promise<RevisionMetric | null>;
  /** Fraction of the month's error budget left, 0 to 1; null when there is no SLO. */
  errorBudget(target: DeployTarget): Promise<number | null>;
}

export interface ConnectionCheck {
  ok: boolean;
  /** "bemmoly-control@acme-bemmoly.iam.gserviceaccount.com". */
  principal: string | null;
  /** Plain words saying what to do next; empty when ok. */
  problems: string[];
}

/** What attaching a project found: its name, and what to grant before deploys can work. */
export interface AccountCheck {
  ok: boolean;
  /** The account's own name in the cloud; null when it could not be read. */
  name: string | null;
  problems: string[];
}

export interface ConnectionPart {
  verify(connection: ConnectionRecord): Promise<ConnectionCheck>;
  /** Checks an account that already exists before Pipelines deploys into it. */
  verifyAccount?(
    connection: ConnectionRecord,
    account: { externalId: string; config: Readonly<Record<string, unknown>> },
  ): Promise<AccountCheck>;
}

/** Boundaries and accounts: a folder and projects, an organizational unit and accounts. */
export interface OrgPart {
  ensureBoundary(connection: ConnectionRecord, name: string): Promise<{ ref: string }>;
  listAccounts(
    connection: ConnectionRecord,
  ): Promise<Array<{ externalId: string; name: string; state: 'ready' | 'creating' | 'deleted' }>>;
  createAccount(
    connection: ConnectionRecord,
    input: { externalId: string; name: string; labels: Readonly<Record<string, string>> },
  ): Promise<{ externalId: string }>;
  /** Problems (quota, billing links) that stop `count` new accounts; empty when fine. */
  checkQuota(connection: ConnectionRecord, count: number): Promise<string[]>;
  /**
   * How many accounts the billing account pays for now, and the limit to compare against.
   * Clouds that publish no limit answer their usual default with `recorded` false.
   */
  billing?(connection: ConnectionRecord): Promise<BillingHeadroom>;
}

/** One neutral resource of the landing zone as declared, before any provider maps it. */
export interface DesiredResource {
  kind: CloudResourceKind;
  name: string;
  /** The account (project) it lives in, by external id. */
  account: string;
  spec: Readonly<Record<string, unknown>>;
  /** "kind/name@account" keys of resources that must exist first. */
  dependsOn: readonly string[];
}

export interface LandingZonePart {
  /** What exists now; null when it does not exist. */
  read(
    connection: ConnectionRecord,
    resource: DesiredResource,
  ): Promise<Record<string, unknown> | null>;
  /** Creates or updates it to match; idempotent, safe to repeat. */
  apply(connection: ConnectionRecord, resource: DesiredResource): Promise<Record<string, unknown>>;
  /** Differences between what is wanted and what was observed; empty when they match. */
  diff(resource: DesiredResource, observed: Record<string, unknown>): string[];
}

export interface RegistryPart {
  ensureRepository(
    connection: ConnectionRecord,
    input: { account: string; name: string; region: string },
  ): Promise<{ repository: string }>;
  grantPull(
    connection: ConnectionRecord,
    input: { repository: string; principal: string },
  ): Promise<void>;
  /** Whether an image with this digest is in the repository. */
  hasDigest(
    connection: ConnectionRecord,
    input: { repository: string; digest: string },
  ): Promise<boolean>;
}

/**
 * Writes and grants (§17). The one read is `accessVersion`, for a CI job's secrets: the
 * server reads them in memory when the runner collects them and keeps them nowhere.
 */
export interface SecretsPart {
  writeVersion(
    connection: ConnectionRecord,
    input: { account: string; name: string; value: string },
  ): Promise<{ version: string }>;
  grantAccess(
    connection: ConnectionRecord,
    input: { account: string; name: string; principal: string },
  ): Promise<void>;
  accessVersion?(
    connection: ConnectionRecord,
    input: { account: string; name: string; version: string },
  ): Promise<string>;
}

export interface AccessPart {
  grant(
    connection: ConnectionRecord,
    input: { account: string; principal: string; role: string; until: Date },
  ): Promise<void>;
  revoke(
    connection: ConnectionRecord,
    input: { account: string; principal: string; role: string },
  ): Promise<void>;
}

export interface CostPart {
  spend(
    connection: ConnectionRecord,
    input: { account: string; from: Date; to: Date },
  ): Promise<{ amount: number; currency: string } | null>;
}

/** What a provider is, and the parts it implements. */
export interface CloudProvider {
  id: Provider;
  name: string;
  description: string;
  /** Parts the provider will have but does not yet: "Coming soon" on screen. */
  comingSoon: readonly ProviderPart[];
  connection?: ConnectionPart;
  org?: OrgPart;
  landingZone?: LandingZonePart;
  registry?: RegistryPart;
  secrets?: SecretsPart;
  targets?: TargetsPart;
  metrics?: MetricsPart;
  runners?: RunnersPart;
  access?: AccessPart;
  cost?: CostPart;
  clusters?: ClustersPart;
  frontDoor?: FrontDoorPart;
  /**
   * Runtimes beyond the default one `targets` and `metrics` serve, such as GKE beside Cloud
   * Run. Target resolution swaps these in for the application's runtime in an environment.
   */
  runtimes?: Partial<Record<DeployRuntime, RuntimeParts>>;
}

export function partAvailability(provider: CloudProvider, part: ProviderPart): PartAvailability {
  if (provider[part]) return 'available';
  return provider.comingSoon.includes(part) ? 'coming_soon' : 'unsupported';
}

export type * from './cluster-contract.ts';
