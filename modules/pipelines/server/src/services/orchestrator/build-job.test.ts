import { describe, expect, it } from 'vitest';
import { buildArgsSchema } from '../../../../shared/build-args.ts';
import {
  pipelineDefinitionSchema,
  pipelineTemplateSchema,
  type PipelineTemplate,
} from '../../../../shared/pipeline-spec.ts';
import { resolvePipeline, type TemplateLookup } from './resolve.ts';

/*
 * Build args: the application's name and folder and the run's inputs are filled in at
 * resolution, so the runner gets plain values. An application extending a template adds
 * args to the template's. Args never name variables or secrets, and an arg named like a
 * secret never takes a value from outside the file.
 */

const template: PipelineTemplate = pipelineTemplateSchema.parse({
  inputs: { node: { default: '24' } },
  build: { dockerfile: 'docker/service.Dockerfile', args: { NODE: '${{ inputs.node }}' } },
});

const lookup: TemplateLookup = async (ref) => (ref.ref === 'acme/service' ? template : null);

const argsOf = async (value: unknown, path = 'services/orders') => {
  const resolved = await resolvePipeline(pipelineDefinitionSchema.parse(value), lookup, {
    application: 'orders',
    path,
    defaultTimeoutMinutes: 30,
  });
  const env = resolved.jobs.find((job) => job.key === 'build')?.steps[0]?.env ?? {};
  return env['BEMMOLY_BUILD_ARGS'] ? JSON.parse(env['BEMMOLY_BUILD_ARGS']) : null;
};

describe('build args', () => {
  it('fills in the application, its folder and inputs', async () => {
    expect(
      await argsOf({
        inputs: { flavour: { default: 'slim' } },
        build: {
          args: {
            SERVICE: '${{ app.name }}',
            APP_DIR: '${{app.path}}/dist',
            FLAVOUR: '${{ inputs.flavour }}',
          },
        },
      }),
    ).toEqual({ SERVICE: 'orders', APP_DIR: 'services/orders/dist', FLAVOUR: 'slim' });
  });

  it('adds an application’s args to its template’s and changes its Dockerfile', async () => {
    const resolved = await resolvePipeline(
      pipelineDefinitionSchema.parse({
        extends: 'acme/service@1',
        with: { node: '25' },
        build: { args: { SERVICE: '${{ app.name }}' } },
      }),
      lookup,
      { application: 'orders', path: 'services/orders', defaultTimeoutMinutes: 30 },
    );
    expect(resolved.jobs[0]?.steps[0]?.env).toMatchObject({
      BEMMOLY_BUILD_DOCKERFILE: 'docker/service.Dockerfile',
      BEMMOLY_BUILD_ARGS: JSON.stringify({ NODE: '25', SERVICE: 'orders' }),
    });
  });

  it('leaves the step env alone when there are no args', async () => {
    expect(await argsOf({ build: { dockerfile: 'Dockerfile' } })).toBeNull();
  });

  it('refuses variables, secrets and unknown names in a value', () => {
    const issue = (args: Record<string, string>) =>
      buildArgsSchema.safeParse(args).error?.issues[0]?.message;
    expect(issue({ DB: '${{ vars.DATABASE_URL }}' })).toBe(
      'Build args take ${{ app.name }}, ${{ app.path }} or ${{ inputs.<name> }}, not ${{ vars.DATABASE_URL }}',
    );
    expect(issue({ NPM: '${{ secrets.NPM_TOKEN }}' })).toMatch(/not \$\{\{ secrets\.NPM_TOKEN/);
    expect(issue({ NPM_TOKEN: '${{ inputs.token }}' })).toBe(
      'NPM_TOKEN looks like a secret and build args stay in the image history, so mount the secret in a step instead',
    );
    expect(issue({ 'bad-name': 'x' })).toMatch(/letters, digits and underscores/);
    expect(buildArgsSchema.safeParse({ SERVICE: '${{ app.name }}', KEY_PATH: '/k' }).success).toBe(
      true,
    );
  });
});
