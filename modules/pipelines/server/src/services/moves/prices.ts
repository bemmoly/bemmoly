import type { DeployRuntime } from '../../../../shared/common.ts';
import type { MoveCost } from '../../../../shared/moves.ts';

/*
 * Rough monthly prices for a move plan, from Google Cloud's public list prices in a Tier 1
 * region on the date below, in US dollars. They are estimates for comparing two runtimes,
 * never a bill: discounts, free tiers, requests, data and regions all change the real number.
 * A month is 730 hours. Both runtimes are priced running the same size all month.
 */

export const PRICES_AS_OF = '2026-10-29';

const HOURS = 730;

const PRICE = {
  /** A forwarding rule, among the first five in a project. */
  forwardingRuleHour: 0.025,
  /** Cloud Run billed by instance, always allocated. */
  cloudRunCpuSecond: 0.000018,
  cloudRunGiBSecond: 0.000002,
  /** GKE Autopilot general-purpose pods. */
  autopilotCpuHour: 0.0445,
  autopilotGiBHour: 0.0049225,
  /** GKE Standard: an E2 node's share for the same size. */
  e2CpuHour: 0.021811,
  e2GiBHour: 0.002923,
  /** GKE's cluster management fee. */
  clusterHour: 0.1,
} as const;

const round = (value: number) => Math.round(value * 100) / 100;

export interface Size {
  cpu: number;
  memoryGiB: number;
}

/** "500m" or 0.5 vCPU, "512Mi" or "1Gi" of memory; Cloud Run's defaults when unset. */
export function sizeOf(config: Readonly<Record<string, unknown>>): Size {
  const deploy = (config['deploy'] ?? {}) as { resources?: { cpu?: unknown; memory?: unknown } };
  const cpu = deploy.resources?.cpu;
  const memory = deploy.resources?.memory;
  const cores =
    typeof cpu === 'number'
      ? cpu
      : typeof cpu === 'string' && /^\d+m$/.test(cpu)
        ? Number(cpu.slice(0, -1)) / 1000
        : typeof cpu === 'string' && Number(cpu) > 0
          ? Number(cpu)
          : 1;
  const match = typeof memory === 'string' ? /^(\d+(?:\.\d+)?)(Mi|Gi)$/.exec(memory) : null;
  const gib = match ? Number(match[1]) / (match[2] === 'Mi' ? 1024 : 1) : 0.5;
  return { cpu: cores, memoryGiB: gib };
}

export function runtimeMonthly(runtime: DeployRuntime, size: Size): number {
  if (runtime === 'cloud-run') {
    const seconds = HOURS * 3600;
    return round(
      seconds * (size.cpu * PRICE.cloudRunCpuSecond + size.memoryGiB * PRICE.cloudRunGiBSecond),
    );
  }
  if (runtime === 'gke-autopilot') {
    return round(
      HOURS * (size.cpu * PRICE.autopilotCpuHour + size.memoryGiB * PRICE.autopilotGiBHour),
    );
  }
  if (runtime === 'gke-standard') {
    return round(HOURS * (size.cpu * PRICE.e2CpuHour + size.memoryGiB * PRICE.e2GiBHour));
  }
  // An attached cluster's nodes are its owners' to pay for.
  return 0;
}

const isCreatedCluster = (runtime: DeployRuntime) =>
  runtime === 'gke-autopilot' || runtime === 'gke-standard';

/**
 * Before and after for one move. The front door and the cluster are already paid for and
 * shared with other applications, so they appear on both sides and change nothing.
 */
export function moveCost(from: DeployRuntime, to: DeployRuntime, size: Size): MoveCost {
  const frontDoor = round(HOURS * PRICE.forwardingRuleHour);
  const cluster = round(HOURS * PRICE.clusterHour);
  const lines: MoveCost['lines'] = [
    { item: 'front-door', runtime: null, before: frontDoor, after: frontDoor },
    { item: 'runtime', runtime: from, before: runtimeMonthly(from, size), after: 0 },
    { item: 'runtime', runtime: to, before: 0, after: runtimeMonthly(to, size) },
  ];
  const clustered = [from, to].find(isCreatedCluster);
  if (clustered)
    lines.push({ item: 'cluster', runtime: clustered, before: cluster, after: cluster });
  const before = round(lines.reduce((sum, line) => sum + line.before, 0));
  const after = round(lines.reduce((sum, line) => sum + line.after, 0));
  return {
    currency: 'USD',
    pricesAsOf: PRICES_AS_OF,
    estimate: true,
    assumes: { cpu: size.cpu, memoryGiB: size.memoryGiB, instances: 1 },
    lines,
    before,
    after,
    difference: round(after - before),
  };
}
