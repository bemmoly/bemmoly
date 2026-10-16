import { spawn, type ChildProcess } from 'node:child_process';
import { constants } from 'node:os';
import type { ResolvedStep } from '@bemmoly/module-pipelines/shared';
import { LineSplitter, dim } from '../utils/lines.ts';
import {
  CANCELLED_EXIT_CODE,
  type StepExecutor,
  type StepResult,
  type StepRunOptions,
} from './types.ts';

const KILL_GRACE_MS = 10_000;

export interface ProcessExecutorOptions {
  /** PATH, HOME and LANG from the runner's own environment; nothing else leaks into steps. */
  hostEnv: Record<string, string>;
  /** Prepended to PATH, so `bemmoly-runner split` works inside a step. */
  binDir?: string;
  /** Set for steps the runner itself composes (an image build), which say nothing about images. */
  quiet?: boolean;
}

/** A step as `sh -c <run>` on this machine, in its own process group so cancel stops it all. */
export class ProcessExecutor implements StepExecutor {
  private child: ChildProcess | undefined;
  private cancelled = false;
  private killTimer: NodeJS.Timeout | undefined;

  private readonly options: ProcessExecutorOptions;

  constructor(options: ProcessExecutorOptions) {
    this.options = options;
  }

  run(step: ResolvedStep, options: StepRunOptions): Promise<StepResult> {
    if (this.cancelled) return Promise.resolve({ exitCode: CANCELLED_EXIT_CODE });
    if (step.image && !this.options.quiet) {
      options.onLine(dim(`Running on this machine; the step's image ${step.image} is not used`));
    }
    const host = this.options.hostEnv;
    const path = [this.options.binDir, host['PATH']].filter(Boolean).join(':');
    const env = { ...host, ...(path ? { PATH: path } : {}), ...options.env };
    return new Promise((resolve, reject) => {
      const child = spawn('sh', ['-c', step.run ?? ''], {
        cwd: options.workspace,
        env,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      this.child = child;
      const stdout = new LineSplitter(options.onLine);
      const stderr = new LineSplitter(options.onLine);
      child.stdout?.on('data', (chunk: Buffer) => stdout.push(chunk));
      child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));
      child.on('error', (error) => {
        this.finish();
        reject(error);
      });
      child.on('close', (code, signal) => {
        stdout.end();
        stderr.end();
        this.finish();
        resolve({ exitCode: exitCodeOf(code, signal) });
      });
    });
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
    const child = this.child;
    if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
    signalGroup(child.pid, 'SIGTERM');
    this.killTimer = setTimeout(() => {
      if (child.pid) signalGroup(child.pid, 'SIGKILL');
    }, KILL_GRACE_MS);
    this.killTimer.unref();
  }

  private finish(): void {
    if (this.killTimer) clearTimeout(this.killTimer);
    this.child = undefined;
  }
}

function signalGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch {
    // The group is already gone.
  }
}

/** Like a shell: a process killed by a signal exits with 128 + the signal's number. */
function exitCodeOf(code: number | null, signal: NodeJS.Signals | null): number {
  if (code !== null) return code;
  if (signal) return 128 + (constants.signals[signal] ?? 1);
  return 1;
}
