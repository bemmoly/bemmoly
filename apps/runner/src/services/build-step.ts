import { realpath } from 'node:fs/promises';
import path from 'node:path';
import type { ClaimedJob, ResolvedStep } from '@bemmoly/module-pipelines/shared';
import type { StepExecutor, StepResult, StepRunOptions } from '../executors/types.ts';
import { isInside } from '../utils/glob.ts';

export const BUILD_ACTION = 'bemmoly/build';

/** `bemmoly/build` or a pinned form such as `bemmoly/build@v1`. */
export function isBuildAction(uses: string): boolean {
  return uses === BUILD_ACTION || uses.startsWith(`${BUILD_ACTION}@`);
}

const quote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

/** Docker repository names are lowercase letters, digits and separators. */
function repositoryPart(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
  return cleaned || 'job';
}

function tagPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, '-').slice(0, 128) || 'latest';
}

/** Where a build leaves its image id, for the finish report's image digests. */
export const IMAGE_ID_FILE = '.bemmoly/image-id';

function buildPaths(step: ResolvedStep): { dockerfile: string; context: string } {
  return {
    dockerfile: step.env['BEMMOLY_BUILD_DOCKERFILE'] || 'Dockerfile',
    context: step.env['BEMMOLY_BUILD_CONTEXT'] || '.',
  };
}

/** The server names the image (bemmoly-local/<application>); the job key is the fallback. */
export function buildTag(job: ClaimedJob, step?: ResolvedStep): string {
  const image = step?.env['BEMMOLY_BUILD_IMAGE'] || `bemmoly-local/${repositoryPart(job.key)}`;
  return `${image}:${tagPart(job.repository.commitSha)}`;
}

/**
 * The shell command for a `bemmoly/build` step, run with the docker CLI against the runner's
 * daemon. The step's `with` values arrive as BEMMOLY_BUILD_DOCKERFILE and BEMMOLY_BUILD_CONTEXT.
 */
export function buildCommand(job: ClaimedJob, step: ResolvedStep): string {
  const { dockerfile, context } = buildPaths(step);
  const tag = quote(buildTag(job, step));
  return [
    `docker build -f ${quote(dockerfile)} -t ${tag} ${quote(context)}`,
    `mkdir -p .bemmoly`,
    `docker image inspect --format '{{.Id}}' ${tag} > ${IMAGE_ID_FILE}`,
  ].join(' && ');
}

/**
 * Why a build may not run, or null. The build runs on this machine, not in a step's container,
 * so a context of "/" or a symlink in the repository would send the host's files to the build.
 */
export async function buildPathProblem(
  workspace: string,
  step: ResolvedStep,
): Promise<string | null> {
  const root = await realpath(workspace);
  const { dockerfile, context } = buildPaths(step);
  for (const [what, value] of [
    ['Dockerfile', dockerfile],
    ['build context', context],
  ] as const) {
    // A path that does not exist yet is judged as written; docker build then reports it missing.
    const real = await realpath(path.resolve(workspace, value)).catch(() =>
      path.resolve(root, value),
    );
    if (!isInside(root, real)) {
      return `The ${what} ${value} is outside the repository; name a path inside it`;
    }
  }
  return null;
}

/**
 * Runs `bemmoly/build` on this machine with none of the pipeline's environment: a PATH,
 * LD_PRELOAD or DOCKER_HOST from a step would otherwise choose what runs on the host.
 */
export class BuildExecutor implements StepExecutor {
  private readonly host: StepExecutor;

  constructor(host: StepExecutor) {
    this.host = host;
  }

  async run(step: ResolvedStep, options: StepRunOptions): Promise<StepResult> {
    const problem = await buildPathProblem(options.workspace, step);
    if (problem) {
      options.onLine(problem);
      return { exitCode: 1 };
    }
    return this.host.run(step, { ...options, env: { CI: 'true' } });
  }

  cancel(): Promise<void> {
    return this.host.cancel();
  }
}
