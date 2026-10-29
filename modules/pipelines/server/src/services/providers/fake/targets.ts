import type { Health } from '../../../../../shared/common.ts';
import type {
  DeployTarget,
  DeployVariable,
  MetricName,
  MetricsPart,
  ReleaseArtifact,
  RevisionWeight,
  TargetsPart,
} from '../contract.ts';

/*
 * Deterministic deploys and metrics for tests and the demo simulator. A release's
 * resolved config can script how its revision behaves: `fake.errorRate` (a fraction) and
 * `fake.latencyMs`, optionally per environment, so a test makes a canary fail by building a release that says so.
 */

interface FakeRevision {
  release: ReleaseArtifact;
  /** What the revision runs with; a secret appears by version, never by value. */
  variables: readonly DeployVariable[];
  errorRate: number;
  latencyMs: number;
}

interface FakeTarget {
  revisions: Map<string, FakeRevision>;
  traffic: RevisionWeight[];
  calls: string[];
}

export interface FakeTargetsWorld {
  targets: Map<string, FakeTarget>;
  /** Every call in order, "deploy checkout-api@dev v1", for assertions. */
  log: string[];
}

const keyOf = (target: DeployTarget) => `${target.application.key}@${target.environment.key}`;

/** "bemmoly-dev/checkout/checkout-api@dev": a revision on a cluster lives in its namespace. */
const kubernetesKeyOf = (target: DeployTarget) => {
  const cluster = target.placement?.cluster;
  if (!cluster) throw new Error(`${keyOf(target)} has no cluster to deploy into`);
  return `${cluster.name}/${target.placement?.namespace ?? 'default'}/${keyOf(target)}`;
};

const numberOr = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** `kubernetes` keeps revisions per cluster and namespace, as GKE deploys do. */
export function createFakeTargets(
  world: FakeTargetsWorld,
  options: { kubernetes?: boolean } = {},
): {
  targets: TargetsPart;
  metrics: MetricsPart;
} {
  const keyFor = options.kubernetes ? kubernetesKeyOf : keyOf;
  const targetOf = (target: DeployTarget): FakeTarget => {
    const key = keyFor(target);
    let found = world.targets.get(key);
    if (!found) {
      found = { revisions: new Map(), traffic: [], calls: [] };
      world.targets.set(key, found);
    }
    return found;
  };
  const record = (target: DeployTarget, call: string) => {
    targetOf(target).calls.push(call);
    world.log.push(`${call} ${keyFor(target)}`);
  };
  const known = (target: DeployTarget, revision: string): FakeRevision => {
    const found = targetOf(target).revisions.get(revision);
    if (!found) throw new Error(`No revision ${revision} in ${keyFor(target)}`);
    return found;
  };

  const targets: TargetsPart = {
    kinds: ['container-service', 'kubernetes', 'function', 'static-site'],
    async deploy(target, release, variables = []) {
      const state = targetOf(target);
      const revision = `${target.application.key}-${release.version}-${state.revisions.size + 1}`;
      // `fake.errorRate@prod-us` wins over `fake.errorRate`, so one release can pass Staging
      // and fail its Prod canary, the way real regressions often do.
      const config = (name: string, fallback: number) =>
        numberOr(
          release.resolvedConfig[`${name}@${target.environment.key}`],
          numberOr(release.resolvedConfig[name], fallback),
        );
      state.revisions.set(revision, {
        release,
        variables,
        errorRate: config('fake.errorRate', 0.002),
        latencyMs: config('fake.latencyMs', 120),
      });
      record(target, `deploy ${release.version}`);
      return { revision };
    },
    async shift(target, { revision, percent, stable }) {
      known(target, revision);
      const traffic: RevisionWeight[] = [{ revision, percent }];
      if (stable && percent < 100) traffic.push({ revision: stable, percent: 100 - percent });
      targetOf(target).traffic = traffic.sort((a, b) => b.percent - a.percent);
      record(target, `shift ${revision} ${percent}`);
    },
    async rollback(target, previousRevision) {
      known(target, previousRevision);
      targetOf(target).traffic = [{ revision: previousRevision, percent: 100 }];
      record(target, `rollback ${previousRevision}`);
    },
    async health(target, revision): Promise<Health> {
      const found = known(target, revision);
      if (found.errorRate >= 0.05) return 'failing';
      return found.errorRate >= 0.01 ? 'degraded' : 'healthy';
    },
    async describe(target) {
      return {
        traffic: [...targetOf(target).traffic],
        url: `https://${target.application.key}.${target.environment.key}.fake.test`,
      };
    },
    async retire(target, revision) {
      const state = targetOf(target);
      if (state.traffic.some((weight) => weight.revision === revision && weight.percent > 0)) {
        throw new Error(`${revision} still takes traffic`);
      }
      state.revisions.delete(revision);
      record(target, `retire ${revision}`);
    },
  };

  const metrics: MetricsPart = {
    async revision(target, revision, metric: MetricName, window) {
      const state = targetOf(target);
      const found = state.revisions.get(revision);
      if (!found) return null;
      const share = state.traffic.find((weight) => weight.revision === revision)?.percent ?? 0;
      const minutes = Math.max(1, Math.round((window.to.getTime() - window.from.getTime()) / 60e3));
      const requests = Math.round(share * 6 * minutes);
      const value = metric === 'error_rate' ? found.errorRate : found.latencyMs;
      const points: Array<[Date, number]> = [];
      for (let i = 0; i < Math.min(minutes, 60); i += 1) {
        points.push([new Date(window.from.getTime() + i * 60e3), value]);
      }
      return { value: requests > 0 ? value : null, requests, points };
    },
    async errorBudget(target) {
      return numberOr(target.connection.config['fake.errorBudget'], 0.62);
    },
  };

  return { targets, metrics };
}
