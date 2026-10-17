import type { CloudResourceKind, Layout } from '../../../../shared/clouds.ts';
import type { EnvironmentClass, Health, Provider, Runtime } from '../../../../shared/common.ts';

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
  /** The project, account or namespace; null for providers that have none (local). */
  account: { externalId: string; name: string } | null;
  application: { id: string; key: string; runtime: Runtime };
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
  deploy(target: DeployTarget, release: ReleaseArtifact): Promise<{ revision: string }>;
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

export interface ConnectionPart {
  verify(connection: ConnectionRecord): Promise<ConnectionCheck>;
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

/** Writes and grants only: Pipelines never reads a secret's value back (§17). */
export interface SecretsPart {
  writeVersion(
    connection: ConnectionRecord,
    input: { account: string; name: string; value: string },
  ): Promise<{ version: string }>;
  grantAccess(
    connection: ConnectionRecord,
    input: { account: string; name: string; principal: string },
  ): Promise<void>;
}

export interface RunnersPart {
  ensurePool(
    connection: ConnectionRecord,
    input: { account: string; name: string; machine: string; min: number; max: number },
  ): Promise<{ ref: string }>;
  scale(connection: ConnectionRecord, input: { ref: string; size: number }): Promise<void>;
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
}

export function partAvailability(provider: CloudProvider, part: ProviderPart): PartAvailability {
  if (provider[part]) return 'available';
  return provider.comingSoon.includes(part) ? 'coming_soon' : 'unsupported';
}
