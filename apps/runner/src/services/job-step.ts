import type { ClaimedJob, ResolvedStep } from '@bemmoly/module-pipelines/shared';
import type { Executors, StepExecutor } from '../executors/index.ts';
import { stripAnsi } from '../utils/lines.ts';
import type { SecretMasker } from '../utils/mask.ts';
import { BUILD_ACTION, BuildExecutor, buildCommand, isBuildAction } from './build-step.ts';

/** Words that mark a line as the error a person would want to read first. */
const ERROR_LINE =
  /(^|[^a-z])(error|errors|fatal|failed|failure|exception|panic|cannot)([^a-z]|$)/i;
const DIM = '\u001b[2m';
const MAX_SUMMARY = 2_000;

/** Finds the first line of a step's own output that looks like an error. */
export class ErrorLineCatcher {
  private found: string | undefined;

  private readonly masker: SecretMasker;

  constructor(masker: SecretMasker) {
    this.masker = masker;
  }

  see(line: string): void {
    // Lines the runner adds about a step (image notes) are dim; only the step's output counts.
    if (this.found !== undefined || line.startsWith(DIM)) return;
    const plain = stripAnsi(line).trim();
    if (plain.length > 0 && ERROR_LINE.test(plain)) {
      this.found = this.masker.mask(plain).slice(0, MAX_SUMMARY);
    }
  }

  get line(): string | undefined {
    return this.found;
  }
}

export interface PreparedStep {
  executor: StepExecutor;
  step: ResolvedStep;
}

/**
 * Picks how a step runs: its `run` through the step executor, `bemmoly/build` through the docker
 * CLI on this machine, anything else refused with a message naming it.
 */
export function prepareStep(
  job: ClaimedJob,
  step: ResolvedStep,
  executors: Executors,
): PreparedStep | { refusal: string } {
  if (step.uses) {
    if (isBuildAction(step.uses)) {
      return {
        executor: new BuildExecutor(executors.host()),
        step: { ...step, run: buildCommand(job, step) },
      };
    }
    return {
      refusal: `This runner cannot run "uses: ${step.uses}"; it supports ${BUILD_ACTION} and run steps`,
    };
  }
  if (!step.run || step.run.trim().length === 0) {
    return { refusal: `Step "${step.name}" has nothing to run: give it run or uses` };
  }
  return { executor: executors.step(), step };
}
