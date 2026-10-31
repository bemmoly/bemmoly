import { ValidationError } from '@bemmoly/shared';
import { APP_INTERPOLATION_PATTERN, BUILD_ARGS_ENV } from '../../../../shared/build-args.ts';
import type {
  BuildSpec,
  PipelineTemplate,
  PipelineExtends,
  ResolvedJob,
  Scalar,
} from '../../../../shared/pipeline-spec.ts';
import { interpolate } from './interpolate.ts';

/*
 * The build job every pipeline with a build starts with: one locked `bemmoly/build` step whose
 * env tells the runner what to build and where to push it. Build args are resolved here, so
 * the runner gets plain values: `${{ app.name }}` and `${{ app.path }}` first, then inputs.
 */

/** The application a pipeline runs for: its key and its folder in the repository. */
export interface BuildApplication {
  name: string | null;
  /** "" for the repository root. */
  path: string;
}

/** The template's build with the application's changes; args add up, the rest replaces. */
export function mergeBuild(
  template: PipelineTemplate['build'],
  own: PipelineExtends['build'],
): BuildSpec | undefined {
  if (!template) {
    if (!own) return undefined;
    return {
      dockerfile: own.dockerfile ?? 'Dockerfile',
      context: own.context ?? '.',
      platforms: own.platforms ?? ['linux/amd64'],
      ...(own.pool ? { pool: own.pool } : {}),
      args: own.args ?? {},
    };
  }
  if (!own) return template;
  return {
    dockerfile: own.dockerfile ?? template.dockerfile,
    context: own.context ?? template.context,
    platforms: own.platforms ?? template.platforms,
    ...((own.pool ?? template.pool) ? { pool: own.pool ?? template.pool } : {}),
    args: { ...template.args, ...own.args },
  };
}

function interpolateApp(text: string, app: BuildApplication): string {
  return text.replace(new RegExp(APP_INTERPOLATION_PATTERN.source, 'g'), (_, name) => {
    if (name === 'name' && app.name) return app.name;
    if (name === 'path') return app.path;
    throw new ValidationError(`"${text}" names app.${name as string}, which a build cannot use`);
  });
}

/** Each arg with its application and inputs filled in. */
export function resolveBuildArgs(
  args: Readonly<Record<string, string>>,
  app: BuildApplication,
  inputs: Readonly<Record<string, Scalar>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(args).map(([name, value]) => [
      name,
      interpolate(interpolateApp(value, app), inputs),
    ]),
  );
}

/** "us-central1-docker.pkg.dev/acme-ci/apps/checkout-api", or a local name. */
function imageName(application: string, registry: string | null): string {
  return registry
    ? `${registry.replace(/\/+$/, '')}/${application}`
    : `bemmoly-local/${application}`;
}

export function buildJob(
  build: BuildSpec,
  app: BuildApplication,
  inputs: Readonly<Record<string, Scalar>>,
  timeout: number,
  registry: string | null,
): ResolvedJob {
  const application = app.name;
  const args = resolveBuildArgs(build.args ?? {}, app, inputs);
  return {
    key: 'build',
    name: 'Build',
    kind: 'build',
    needs: [],
    steps: [
      {
        key: 'build',
        name: 'Build image',
        image: null,
        run: null,
        uses: 'bemmoly/build',
        env: {
          BEMMOLY_BUILD_DOCKERFILE: build.dockerfile,
          BEMMOLY_BUILD_CONTEXT: build.context,
          BEMMOLY_BUILD_PLATFORMS: build.platforms.join(','),
          ...(Object.keys(args).length > 0 ? { [BUILD_ARGS_ENV]: JSON.stringify(args) } : {}),
          // The image a passing build becomes a release of, pushed when there is a registry.
          ...(application ? { BEMMOLY_BUILD_IMAGE: imageName(application, registry) } : {}),
          ...(application && registry ? { BEMMOLY_BUILD_PUSH: 'true' } : {}),
        },
        secrets: [],
        locked: true,
        origin: 'template',
        junit: null,
        artifacts: [],
      },
    ],
    pool: build.pool ?? null,
    shards: null,
    timeoutMinutes: timeout,
    application,
    matrix: null,
  };
}
