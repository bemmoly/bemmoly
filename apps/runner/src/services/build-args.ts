import { BUILD_ARG_NAME, BUILD_ARGS_ENV } from '@bemmoly/module-pipelines/shared';
import type { ResolvedStep } from '@bemmoly/module-pipelines/shared';

/*
 * Build args arrive resolved, as a JSON object in the build step's env. Each becomes one
 * `--build-arg 'NAME=value'`, single-quoted, so a value with spaces, quotes or `$(…)` reaches
 * Docker or Kaniko as text and never runs in the shell that starts the build.
 */

const quote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

type Read = { ok: true; args: Array<[string, string]> } | { ok: false; problem: string };

export function readBuildArgs(step: ResolvedStep): Read {
  const raw = step.env[BUILD_ARGS_ENV];
  if (!raw) return { ok: true, args: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, problem: 'The build args did not arrive as JSON. Run the job again' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, problem: 'The build args did not arrive as names and values' };
  }
  const args: Array<[string, string]> = [];
  for (const [name, value] of Object.entries(parsed)) {
    if (!BUILD_ARG_NAME.test(name) || typeof value !== 'string') {
      return { ok: false, problem: `The build arg ${JSON.stringify(name)} cannot be passed on` };
    }
    args.push([name, value]);
  }
  return { ok: true, args };
}

/** Why the args cannot be passed on, or null. */
export function buildArgsProblem(step: ResolvedStep): string | null {
  const read = readBuildArgs(step);
  return read.ok ? null : read.problem;
}

/** " --build-arg 'SERVICE=orders'" per arg, or "" when there are none or they do not read. */
export function buildArgFlags(step: ResolvedStep): string {
  const read = readBuildArgs(step);
  if (!read.ok) return '';
  return read.args.map(([name, value]) => ` --build-arg ${quote(`${name}=${value}`)}`).join('');
}
