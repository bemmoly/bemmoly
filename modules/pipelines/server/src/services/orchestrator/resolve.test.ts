import { describe, expect, it } from 'vitest';
import {
  pipelineDefinitionSchema,
  pipelineTemplateSchema,
  type PipelineTemplate,
} from '../../../../shared/pipeline-spec.ts';
import { resolvePipeline, type TemplateLookup } from './resolve.ts';

const template: PipelineTemplate = pipelineTemplateSchema.parse({
  inputs: { node: { default: '24' }, port: { type: 'number', default: 8080 } },
  build: { dockerfile: 'Dockerfile' },
  test: [
    { name: 'Unit', image: 'node:${{ inputs.node }}', run: 'pnpm test', shards: 'auto' },
    { name: 'Security scan', key: 'scan', uses: 'acme/scan@2', locked: true },
  ],
  deploy: { kind: 'container-service', port: '${{ inputs.port }}' },
});

const lookup: TemplateLookup = async (ref) =>
  ref.ref === 'acme/node-service' && ref.version === 3 ? template : null;

const options = { application: 'checkout-api', defaultTimeoutMinutes: 60 };

function definition(value: unknown) {
  return pipelineDefinitionSchema.parse(value);
}

describe('resolvePipeline', () => {
  it('keeps every deploy setting a release needs, public access included', async () => {
    const resolved = await resolvePipeline(
      definition({
        build: { dockerfile: 'Dockerfile' },
        deploy: {
          kind: 'container-service',
          port: 3000,
          public: true,
          resources: { memory: '512Mi' },
        },
      }),
      lookup,
      options,
    );
    expect(resolved.deploy).toMatchObject({
      port: 3000,
      public: true,
      resources: { memory: '512Mi' },
    });
  });

  it('names the image after the registry and pushes it when there is one', async () => {
    const pipeline = definition({ extends: 'acme/node-service@3' });
    const env = async (registry: string | null) =>
      (await resolvePipeline(pipeline, lookup, { ...options, registry })).jobs[0]?.steps[0]?.env;
    expect(await env('us-central1-docker.pkg.dev/acme-ci/apps/')).toMatchObject({
      BEMMOLY_BUILD_IMAGE: 'us-central1-docker.pkg.dev/acme-ci/apps/checkout-api',
      BEMMOLY_BUILD_PUSH: 'true',
    });
    const local = await env(null);
    expect(local?.['BEMMOLY_BUILD_IMAGE']).toBe('bemmoly-local/checkout-api');
    expect(local).not.toHaveProperty('BEMMOLY_BUILD_PUSH');
  });

  it('fills a template from with, keeps its locked step and stores what will run', async () => {
    const resolved = await resolvePipeline(
      definition({ extends: 'acme/node-service@3', with: { port: 8081 } }),
      lookup,
      options,
    );
    expect(resolved.template).toEqual({ ref: 'acme/node-service', version: 3 });
    expect(resolved.inputs).toEqual({ node: '24', port: 8081 });
    expect(resolved.deploy?.port).toBe('8081');
    expect(resolved.jobs.map((job) => [job.key, job.needs])).toEqual([
      ['build', []],
      ['unit', ['build']],
      ['scan', ['build']],
    ]);
    const unit = resolved.jobs[1];
    expect(unit?.steps[0]).toMatchObject({ image: 'node:24', origin: 'template', locked: false });
    expect(resolved.jobs[2]?.steps[0]).toMatchObject({ uses: 'acme/scan@2', locked: true });
  });

  it('lets a manual run set inputs, typed, and refuses unknown or mistyped ones', async () => {
    const extending = definition({ extends: 'acme/node-service@3' });
    const resolved = await resolvePipeline(extending, lookup, {
      ...options,
      inputs: { node: '25', port: '9000' },
    });
    expect(resolved.inputs).toEqual({ node: '25', port: 9000 });
    await expect(
      resolvePipeline(extending, lookup, { ...options, inputs: { colour: 'red' } }),
    ).rejects.toThrow('no input called "colour"');
    await expect(
      resolvePipeline(extending, lookup, { ...options, inputs: { port: 'eighty' } }),
    ).rejects.toThrow('takes a number');
  });

  it('replaces an unlocked template step by key and refuses to touch a locked one', async () => {
    const replaced = await resolvePipeline(
      definition({
        extends: 'acme/node-service@3',
        test: [{ name: 'Unit', run: 'pnpm vitest run', image: 'node:24' }],
      }),
      lookup,
      options,
    );
    expect(replaced.jobs.find((job) => job.key === 'unit')?.steps[0]).toMatchObject({
      run: 'pnpm vitest run',
      origin: 'application',
    });
    await expect(
      resolvePipeline(
        definition({
          extends: 'acme/node-service@3',
          test: [{ name: 'Skip scan', key: 'scan', run: 'true' }],
        }),
        lookup,
        options,
      ),
    ).rejects.toThrow('locked by the template');
  });

  it('expands a matrix into one job per cell and points needs at every cell', async () => {
    const resolved = await resolvePipeline(
      definition({
        test: [
          {
            name: 'Unit',
            image: 'node:${{ matrix.node }}',
            run: 'pnpm test',
            matrix: { axes: { node: [22, 24] }, include: [{ node: 25 }], exclude: [{ node: 22 }] },
          },
          { name: 'Report', run: 'echo done', needs: ['unit'] },
        ],
      }),
      lookup,
      options,
    );
    expect(resolved.jobs.map((job) => job.key)).toEqual(['unit-24', 'unit-25', 'report']);
    expect(resolved.jobs[0]).toMatchObject({ name: 'Unit (node 24)', matrix: { node: 24 } });
    expect(resolved.jobs[0]?.steps[0]?.image).toBe('node:24');
    expect(resolved.jobs[2]?.needs).toEqual(['unit-24', 'unit-25']);
  });

  it('says plainly when a template is missing, a need is unknown or needs loop', async () => {
    await expect(
      resolvePipeline(definition({ extends: 'acme/node-service@9' }), lookup, options),
    ).rejects.toThrow('Template acme/node-service@9 is not available');
    await expect(
      resolvePipeline(
        definition({ test: [{ name: 'A', run: 'x', needs: ['b'] }] }),
        lookup,
        options,
      ),
    ).rejects.toThrow('needs "b", which is not a step');
    await expect(
      resolvePipeline(
        definition({
          test: [
            { name: 'A', run: 'x', needs: ['b'] },
            { name: 'B', run: 'x', needs: ['a'] },
          ],
        }),
        lookup,
        options,
      ),
    ).rejects.toThrow('in a loop');
  });
});
