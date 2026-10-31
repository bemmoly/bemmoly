import type { ClaimedJob, ResolvedStep } from '@bemmoly/module-pipelines/shared';
import { buildArgFlags } from './build-args.ts';
import { buildTag, IMAGE_ID_FILE, IMAGE_PLATFORM_FILE, pushPlatform } from './build-step.ts';

/*
 * A `bemmoly/build` step in a pod with no Docker daemon (GKE Autopilot): Kaniko builds the
 * image in its own container beside the runner, from the workspace they share, and pushes it
 * with the pod's own Google identity. Kaniko builds for the platform of the node it runs on,
 * so a build for another platform is refused rather than made wrong.
 */

const KANIKO = '/kaniko/executor';
/** Autopilot runs general-purpose pods on x86 nodes unless asked for Arm. */
export const POD_PLATFORM = 'linux/amd64';

const quote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

/** Why this build cannot run in the pod, or null. */
export function kanikoProblem(step: ResolvedStep): string | null {
  if (step.env['BEMMOLY_BUILD_PUSH'] !== 'true') return null;
  const platform = pushPlatform(step);
  return platform === POD_PLATFORM
    ? null
    : `Image builds on this pool run on ${POD_PLATFORM} nodes, so they cannot build for ${platform}. Build it on machines you start, or on Cloud Build`;
}

/** The shell command the builder container runs in the job's workspace. */
export function kanikoCommand(job: ClaimedJob, step: ResolvedStep): string {
  const dockerfile = step.env['BEMMOLY_BUILD_DOCKERFILE'] || 'Dockerfile';
  const context = step.env['BEMMOLY_BUILD_CONTEXT'] || '.';
  // Kaniko reads paths from its own working folder, so both are made absolute first.
  const paths = `--dockerfile "$PWD"/${quote(dockerfile)} --context dir://"$PWD"/${quote(context)}${buildArgFlags(step)}`;
  if (step.env['BEMMOLY_BUILD_PUSH'] !== 'true') {
    return `${KANIKO} ${paths} --no-push --cleanup`;
  }
  return [
    'mkdir -p .bemmoly',
    `${KANIKO} ${paths} --destination ${quote(buildTag(job, step))} --digest-file "$PWD"/${IMAGE_ID_FILE} --cleanup`,
    `test -s ${IMAGE_ID_FILE} || { echo 'Kaniko did not report a digest for the pushed image'; exit 1; }`,
    `printf '%s' ${quote(POD_PLATFORM)} > ${IMAGE_PLATFORM_FILE}`,
  ].join(' && ');
}
