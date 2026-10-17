import { DockerEngine } from '../clients/docker-engine.ts';
import { DockerExecutor } from './docker.ts';
import { ProcessExecutor } from './process.ts';
import type { StepExecutor } from './types.ts';

export type { StepExecutor, StepResult, StepRunOptions } from './types.ts';

export interface ExecutorSettings {
  /** Steps run as processes on this machine instead of containers. */
  local: boolean;
  dockerSocket: string;
  hostEnv: Record<string, string>;
  /** Holds the bemmoly-runner shim local steps find on PATH. */
  binDir?: string;
}

/** Where steps run, and where the runner's own commands (check out, image builds) run. */
export interface Executors {
  step(): StepExecutor;
  /** Always a process on this machine, pointed at the runner's Docker daemon. */
  host(): StepExecutor;
}

export function createExecutors(settings: ExecutorSettings): Executors {
  const engine = new DockerEngine(settings.dockerSocket);
  const hostEnv = { ...settings.hostEnv, DOCKER_HOST: `unix://${settings.dockerSocket}` };
  return {
    step: () =>
      settings.local
        ? new ProcessExecutor({ hostEnv: settings.hostEnv, binDir: settings.binDir })
        : new DockerExecutor(engine),
    host: () => new ProcessExecutor({ hostEnv, binDir: settings.binDir, quiet: true }),
  };
}
