import type { ClaimedJob, ResolvedStep } from '@bemmoly/module-pipelines/shared';
import type { Executors, StepExecutor } from '../executors/index.ts';
import { stripAnsi } from '../utils/lines.ts';
import type { SecretMasker } from '../utils/mask.ts';
import { buildArgsProblem } from './build-args.ts';
import { kanikoCommand, kanikoProblem } from './build-kaniko.ts';
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
 * CLI on this machine (or through Kaniko beside the runner, in a pod with no daemon), anything
 * else refused with a message naming it.
 */
export function prepareStep(
  job: ClaimedJob,
  step: ResolvedStep,
  executors: Executors,
  allowBuildPaths: readonly string[] = [],
): PreparedStep | { refusal: string } {
  if (step.uses) {
    const argsProblem = isBuildAction(step.uses) ? buildArgsProblem(step) : null;
    if (argsProblem) return { refusal: argsProblem };
    if (isBuildAction(step.uses) && executors.builder) {
      const builder = executors.builder();
      if (!builder) {
        return {
          refusal:
            'This pod has no container for image builds. Run the job again, so its pod is made for its steps',
        };
      }
      const problem = kanikoProblem(step);
      if (problem) return { refusal: problem };
      return {
        executor: new BuildExecutor(builder, allowBuildPaths),
        step: { ...step, run: kanikoCommand(job, step) },
      };
    }
    if (isBuildAction(step.uses)) {
      return {
        executor: new BuildExecutor(executors.host(), allowBuildPaths),
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
