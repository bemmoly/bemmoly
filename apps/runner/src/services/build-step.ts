import type { ClaimedJob, ResolvedStep } from '@bemmoly/module-pipelines/shared';

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

export function buildTag(job: ClaimedJob): string {
  return `bemmoly-local/${repositoryPart(job.key)}:${tagPart(job.repository.commitSha)}`;
}

/**
 * The shell command for a `bemmoly/build` step, run with the docker CLI against the runner's
 * daemon. The step's `with` values arrive as BEMMOLY_BUILD_DOCKERFILE and BEMMOLY_BUILD_CONTEXT.
 */
export function buildCommand(job: ClaimedJob, step: ResolvedStep): string {
  const dockerfile = step.env['BEMMOLY_BUILD_DOCKERFILE'] || 'Dockerfile';
  const context = step.env['BEMMOLY_BUILD_CONTEXT'] || '.';
  return `docker build -f ${quote(dockerfile)} -t ${quote(buildTag(job))} ${quote(context)}`;
}
