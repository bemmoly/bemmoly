import type { DeployRuntime } from '@bemmoly/module-pipelines/shared';

/** Each runtime's name on screen; message ids cannot carry the runtime's own dashes. */
export const RUNTIME_NAME = {
  'cloud-run': 'pipelines.runtimes.name.cloudRun',
  'gke-autopilot': 'pipelines.runtimes.name.gkeAutopilot',
  'gke-standard': 'pipelines.runtimes.name.gkeStandard',
  'attached-cluster': 'pipelines.runtimes.name.attachedCluster',
} as const satisfies Record<DeployRuntime, string>;

/** What each runtime means for the bill, in one sentence. */
export const RUNTIME_COST = {
  'cloud-run': 'pipelines.runtimes.cost.cloudRun',
  'gke-autopilot': 'pipelines.runtimes.cost.gkeAutopilot',
  'gke-standard': 'pipelines.runtimes.cost.gkeStandard',
  'attached-cluster': 'pipelines.runtimes.cost.attachedCluster',
} as const satisfies Record<DeployRuntime, string>;
