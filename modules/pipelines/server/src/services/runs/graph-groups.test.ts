import { describe, expect, it } from 'vitest';
import { groupStages } from './graph-groups.ts';

const environments = [
  { key: 'dev', name: 'Dev', where: 'acme-dev' },
  { key: 'stage', name: 'Stage', where: 'acme-stage' },
];

describe('a run graph grouped by environment', () => {
  it('lays each group out after the one before it, in path order', () => {
    const { stageOf, groups } = groupStages(
      [
        { key: 'build', needs: [], environment: null },
        { key: 'unit', needs: ['build'], environment: null },
        { key: 'deploy-stage', needs: ['smoke-dev'], environment: 'stage' },
        { key: 'deploy-dev', needs: ['unit'], environment: 'dev' },
        { key: 'smoke-dev', needs: ['deploy-dev'], environment: 'dev' },
      ],
      environments,
      'Build',
    );
    expect(Object.fromEntries(stageOf)).toEqual({
      build: 0,
      unit: 1,
      'deploy-dev': 2,
      'smoke-dev': 3,
      'deploy-stage': 4,
    });
    expect(groups).toEqual([
      { name: 'Build', environment: null, where: 'Cloud Build', stages: [0, 1] },
      { name: 'Dev', environment: 'dev', where: 'acme-dev', stages: [2, 3] },
      { name: 'Stage', environment: 'stage', where: 'acme-stage', stages: [4] },
    ]);
  });

  it('draws a pipeline with no environment steps as before, ungrouped', () => {
    const { stageOf, groups } = groupStages(
      [
        { key: 'build', needs: [], environment: null },
        { key: 'unit', needs: ['build'], environment: null },
      ],
      environments,
      'Build',
    );
    expect(groups).toEqual([]);
    expect(stageOf.get('unit')).toBe(1);
  });
});
