import type { DeployRuntime } from '@bemmoly/module-pipelines/shared';

/** Each runtime's name on screen; message ids cannot carry the runtime's own dashes. */
export const RUNTIME_NAME = {
  'cloud-run': 'pipelines.runtimes.name.cloudRun',
  'gke-autopilot': 'pipelines.runtimes.name.gkeAutopilot',
  'gke-standard': 'pipelines.runtimes.name.gkeStandard',
  'attached-cluster': 'pipelines.runtimes.name.attachedCluster',
} as const satisfies Record<DeployRuntime, string>;
