import type { RunnerPod } from '@bemmoly/module-pipelines/shared';
import { DockerEngine } from '../clients/docker-engine.ts';
import { DockerExecutor } from './docker.ts';
import { PodExecutor, stepTarget } from './pod.ts';
import { ProcessExecutor } from './process.ts';
import type { StepExecutor } from './types.ts';

export type { StepExecutor, StepResult, StepRunOptions } from './types.ts';

export interface ExecutorSettings {
  /** Steps run as processes on this machine instead of containers. */
  local: boolean;
  dockerSocket: string;
  /** Step containers mount this container's volumes rather than the workspace's host path. */
  volumesFrom?: string;
  hostEnv: Record<string, string>;
  /** Holds the bemmoly-runner shim local steps find on PATH. */
  binDir?: string;
  /** Set in a pod that holds a container per step image: steps run there, not on a daemon. */
  pod?: RunnerPod;
}

/** Where steps run, and where the runner's own commands (check out, image builds) run. */
export interface Executors {
  step(): StepExecutor;
  /** Always a process on this machine, pointed at the runner's Docker daemon. */
  host(): StepExecutor;
  /** In a pod, where image builds run; null when the pod has no container for them. */
  builder?(): StepExecutor | null;
}

export function createExecutors(settings: ExecutorSettings): Executors {
  const pod = settings.pod;
  if (pod) {
    const builder = pod.builder;
    return {
      step: () => new PodExecutor(pod, (step) => stepTarget(pod, step)),
      host: () =>
        new ProcessExecutor({ hostEnv: settings.hostEnv, binDir: settings.binDir, quiet: true }),
      builder: () =>
        builder ? new PodExecutor(pod, () => ({ container: builder, missing: '' })) : null,
    };
  }
  const engine = new DockerEngine(settings.dockerSocket);
  const hostEnv = { ...settings.hostEnv, DOCKER_HOST: `unix://${settings.dockerSocket}` };
  return {
    step: () =>
      settings.local
        ? new ProcessExecutor({ hostEnv: settings.hostEnv, binDir: settings.binDir })
        : new DockerExecutor(engine, settings.volumesFrom),
    host: () => new ProcessExecutor({ hostEnv, binDir: settings.binDir, quiet: true }),
  };
}
