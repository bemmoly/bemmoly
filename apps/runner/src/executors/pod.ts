import { access, mkdir, open, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_STEP_IMAGE,
  type ResolvedStep,
  type RunnerPod,
} from '@bemmoly/module-pipelines/shared';
import { LineSplitter, dim } from '../utils/lines.ts';
import {
  CANCELLED_EXIT_CODE,
  type StepExecutor,
  type StepResult,
  type StepRunOptions,
} from './types.ts';

/*
 * A step in a container beside the runner, in a pod that holds one container per step image
 * (GKE Autopilot allows no Docker daemon). The runner hands the step to that container's agent
 * (agent/step-agent.sh) through files on a volume both see: the script, its environment and
 * the workspace, then a go file. It follows the step's output as the agent writes it and
 * reads the exit code when it ends.
 */

const POLL_MS = 250;
/** An agent picks a step up within a second or two; longer means its container is gone. */
const PICKUP_MS = 60_000;
/** After a cancel, how long to wait for the agent before giving up on the step. */
const CANCEL_WAIT_MS = 30_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** The step's environment as lines the agent's shell sources; names a shell cannot set are left out. */
export function envFile(env: Record<string, string>): string {
  return Object.entries(env)
    .filter(([name]) => ENV_NAME.test(name))
    .map(([name, value]) => `export ${name}=${quote(value)}\n`)
    .join('');
}

export interface PodTarget {
  /** The container's name in the pod, or null when the pod has none for this step. */
  container: string | null;
  /** What a person reads when there is none. */
  missing: string;
}

/** Which container runs a run step: the one for its image. */
export function stepTarget(pod: RunnerPod, step: ResolvedStep): PodTarget {
  const image = step.image ?? DEFAULT_STEP_IMAGE;
  return {
    container: pod.steps[image] ?? null,
    missing: `This pod has no container for ${image}, so the step cannot run here. Run the job again, so its pod is made for its steps`,
  };
}

export class PodExecutor implements StepExecutor {
  private cancelled = false;

  private readonly pod: RunnerPod;
  private readonly target: (step: ResolvedStep) => PodTarget;

  constructor(pod: RunnerPod, target: (step: ResolvedStep) => PodTarget) {
    this.pod = pod;
    this.target = target;
  }

  async run(step: ResolvedStep, options: StepRunOptions): Promise<StepResult> {
    if (this.cancelled) return { exitCode: CANCELLED_EXIT_CODE };
    const target = this.target(step);
    if (!target.container) {
      options.onLine(target.missing);
      return { exitCode: 1 };
    }
    if (!step.image && step.run)
      options.onLine(dim(`No image named; running in ${DEFAULT_STEP_IMAGE}`));
    const inbox = path.join(this.pod.control, target.container);
    const logs = path.join(this.pod.logs, target.container);
    const id = options.label.replace(/[^A-Za-z0-9_.-]/g, '-');
    await mkdir(inbox, { recursive: true });
    await writeFile(path.join(inbox, `${id}.sh`), step.run ?? '');
    await writeFile(path.join(inbox, `${id}.env`), envFile(options.env), { mode: 0o600 });
    await writeFile(path.join(inbox, `${id}.cwd`), options.workspace);
    // The go file appears whole, so the agent never starts a step half written.
    await writeFile(path.join(inbox, `${id}.go.tmp`), '');
    await rename(path.join(inbox, `${id}.go.tmp`), path.join(inbox, `${id}.go`));
    return this.follow(inbox, logs, id, options);
  }

  /** The step's agent is told within a poll, and the step then ends as the stop made it. */
  async cancel(): Promise<void> {
    this.cancelled = true;
  }

  private async follow(
    inbox: string,
    logs: string,
    id: string,
    options: StepRunOptions,
  ): Promise<StepResult> {
    const lines = new LineSplitter(options.onLine, options.mask);
    const out = path.join(logs, `${id}.out`);
    const exit = path.join(logs, `${id}.exit`);
    const started = Date.now();
    let offset = 0;
    let cancelledAt: number | null = null;
    const drain = async () => {
      const file = await open(out, 'r').catch(() => null);
      if (!file) return;
      try {
        const buffer = Buffer.alloc(64 * 1024);
        for (;;) {
          const { bytesRead } = await file.read(buffer, 0, buffer.length, offset);
          if (bytesRead === 0) break;
          offset += bytesRead;
          lines.push(buffer.subarray(0, bytesRead));
        }
      } finally {
        await file.close();
      }
    };
    for (;;) {
      const ended = await exists(exit);
      await drain();
      if (ended) {
        lines.end();
        const code = Number.parseInt((await readFile(exit, 'utf8')).trim(), 10);
        return { exitCode: Number.isInteger(code) ? code : 1 };
      }
      if (this.cancelled && cancelledAt === null) {
        cancelledAt = Date.now();
        await writeFile(path.join(inbox, `${id}.cancel`), '');
      }
      if (cancelledAt !== null && Date.now() - cancelledAt > CANCEL_WAIT_MS) {
        lines.end();
        return { exitCode: CANCELLED_EXIT_CODE };
      }
      if (Date.now() - started > PICKUP_MS && (await exists(path.join(inbox, `${id}.go`)))) {
        lines.end();
        options.onLine(
          'The container for this step did not pick it up; its agent may have stopped',
        );
        return { exitCode: 1 };
      }
      await sleep(POLL_MS);
    }
  }
}
