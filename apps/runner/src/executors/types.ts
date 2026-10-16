import type { ResolvedStep } from '@bemmoly/module-pipelines/shared';

export interface StepRunOptions {
  /** The job's workspace on this machine. */
  workspace: string;
  env: Record<string, string>;
  /** Called once per output line, in order, stdout and stderr together. */
  onLine: (line: string) => void;
  /** A name the step's container or process can be found by, unique to the job and step. */
  label: string;
}

export interface StepResult {
  exitCode: number;
}

/** Runs one step; one instance per step, so cancel always means the step running now. */
export interface StepExecutor {
  run(step: ResolvedStep, options: StepRunOptions): Promise<StepResult>;
  /** Stops the step; run() then resolves with the exit code the stop produced. */
  cancel(): Promise<void>;
}

/** The exit code a shell reports for a command stopped by SIGINT, used for steps never started. */
export const CANCELLED_EXIT_CODE = 130;
