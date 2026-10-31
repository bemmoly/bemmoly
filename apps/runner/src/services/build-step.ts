import { realpath } from 'node:fs/promises';
import path from 'node:path';
import type { ClaimedJob, ResolvedStep } from '@bemmoly/module-pipelines/shared';
import type { StepExecutor, StepResult, StepRunOptions } from '../executors/types.ts';
import { isInside } from '../utils/glob.ts';
import { buildArgFlags } from './build-args.ts';

export { BUILD_ACTION, isBuildAction } from '@bemmoly/module-pipelines/shared';

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
/** The platform a pushed image was built for, when it is not the default. */
export const IMAGE_PLATFORM_FILE = '.bemmoly/image-platform';
const PUSH_LOG = '.bemmoly/push.log';

/** The first platform the pipeline names; a pushed image is built for exactly one. */
export function pushPlatform(step: ResolvedStep): string {
  const first = (step.env['BEMMOLY_BUILD_PLATFORMS'] ?? '').split(',')[0]?.trim();
  return first && /^[a-z0-9]+\/[a-z0-9]+(\/[a-z0-9]+)?$/.test(first) ? first : 'linux/amd64';
}

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
 * daemon. The step's `with` values arrive as BEMMOLY_BUILD_DOCKERFILE and BEMMOLY_BUILD_CONTEXT,
 * its build args as BEMMOLY_BUILD_ARGS.
 * With BEMMOLY_BUILD_PUSH the image is built for the deploy platform (a laptop on ARM would
 * otherwise build an image Cloud Run cannot start), pushed with this machine's own docker
 * credentials, and reported by its registry digest instead of its local id.
 */
export function buildCommand(job: ClaimedJob, step: ResolvedStep): string {
  const { dockerfile, context } = buildPaths(step);
  const tag = quote(buildTag(job, step));
  const args = buildArgFlags(step);
  if (step.env['BEMMOLY_BUILD_PUSH'] !== 'true') {
    return [
      `docker build -f ${quote(dockerfile)}${args} -t ${tag} ${quote(context)}`,
      `mkdir -p .bemmoly`,
      `docker image inspect --format '{{.Id}}' ${tag} > ${IMAGE_ID_FILE}`,
    ].join(' && ');
  }
  const platform = quote(pushPlatform(step));
  return [
    `docker build --platform ${platform} -f ${quote(dockerfile)}${args} -t ${tag} ${quote(context)}`,
    `mkdir -p .bemmoly`,
    // The log is kept to read the digest from; it is printed so the push shows in the job log.
    `{ docker push ${tag} > ${PUSH_LOG} 2>&1; pushed=$?; cat ${PUSH_LOG}; [ "$pushed" -eq 0 ]; }`,
    `sed -n 's/.*digest: \\(sha256:[0-9a-f]\\{64\\}\\).*/\\1/p' ${PUSH_LOG} | tail -n 1 > ${IMAGE_ID_FILE}`,
    `test -s ${IMAGE_ID_FILE} || { echo 'The registry did not report a digest for the pushed image'; exit 1; }`,
    `printf '%s' ${platform} > ${IMAGE_PLATFORM_FILE}`,
  ].join(' && ');
}

/**
 * Why a build may not run, or null. The build runs on this machine, not in a step's container,
 * so a context of "/" or a symlink in the repository would send the host's files to the build.
 */
export async function buildPathProblem(
  workspace: string,
  step: ResolvedStep,
  allowed: readonly string[] = [],
): Promise<string | null> {
  const root = await realpath(workspace);
  const roots = [
    root,
    ...(await Promise.all(allowed.map((dir) => realpath(dir).catch(() => dir)))),
  ];
  const { dockerfile, context } = buildPaths(step);
  for (const [what, value] of [
    ['Dockerfile', dockerfile],
    ['build context', context],
  ] as const) {
    const written = path.resolve(root, value);
    // A path that does not exist yet is judged by its resolved folder (macOS /var is
    // /private/var); docker build then reports it missing.
    const real = await realpath(path.resolve(workspace, value)).catch(async () =>
      path.join(
        await realpath(path.dirname(written)).catch(() => path.dirname(written)),
        path.basename(written),
      ),
    );
    if (!roots.some((inside) => isInside(inside, real))) {
      return `The ${what} ${value} is outside the repository; name a path inside it, or start the runner with --allow-build-path`;
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

  private readonly allowed: readonly string[];

  constructor(host: StepExecutor, allowed: readonly string[] = []) {
    this.host = host;
    this.allowed = allowed;
  }

  async run(step: ResolvedStep, options: StepRunOptions): Promise<StepResult> {
    const problem = await buildPathProblem(options.workspace, step, this.allowed);
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
