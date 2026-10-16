import { describe, expect, it } from 'vitest';
import { pipelineDefinitionSchema } from '../../../../shared/pipeline-spec.ts';
import { autoShards, expandJobs, stagesOf } from './expand.ts';
import { resolvePipeline } from './resolve.ts';

async function pipeline(test: unknown[]) {
  return resolvePipeline(pipelineDefinitionSchema.parse({ build: {}, test }), async () => null, {
    application: 'app',
    defaultTimeoutMinutes: 60,
  });
}

describe('expandJobs', () => {
  it('fans auto shards out from timings and makes dependants need every shard', async () => {
    const resolved = await pipeline([
      { name: 'Unit', run: 'pnpm test', shards: 'auto' },
      { name: 'Publish', run: 'echo', needs: ['unit'] },
    ]);
    const plans = expandJobs([
      { id: 'a', key: 'app', teamId: 't', pipeline: resolved, testSeconds: 500 },
    ]);
    expect(plans.map((plan) => plan.key)).toEqual([
      'build',
      'unit-1',
      'unit-2',
      'unit-3',
      'publish',
    ]);
    expect(plans[1]).toMatchObject({ name: 'Unit 1 of 3', shardIndex: 1, shardTotal: 3 });
    expect(plans[4]?.needs).toEqual(['unit-1', 'unit-2', 'unit-3']);
    const stages = stagesOf(plans);
    expect([stages.get('build'), stages.get('unit-2'), stages.get('publish')]).toEqual([0, 1, 2]);
  });

  it('runs one shard when nothing is known yet, and caps auto shards', () => {
    expect(autoShards(0)).toBe(1);
    expect(autoShards(170)).toBe(1);
    expect(autoShards(100_000)).toBe(8);
  });

  it('prefixes keys with the application when a run covers several', async () => {
    const resolved = await pipeline([{ name: 'Unit', run: 'x' }]);
    const plans = expandJobs([
      { id: 'a', key: 'web', teamId: null, pipeline: resolved, testSeconds: 0 },
      { id: 'b', key: 'api', teamId: null, pipeline: resolved, testSeconds: 0 },
    ]);
    expect(plans.map((plan) => [plan.key, plan.needs])).toEqual([
      ['web.build', []],
      ['web.unit', ['web.build']],
      ['api.build', []],
      ['api.unit', ['api.build']],
    ]);
  });
});
