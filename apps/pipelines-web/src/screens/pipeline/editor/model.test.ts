import { describe, expect, it } from 'vitest';
import { addStep, editable, layoutOf, removeStep, updateStep } from './model.ts';
import { pipelineYaml } from './yaml.ts';

const words = { build: 'Build', buildWhere: 'Cloud Build', kind: (kind: string) => kind };
const environments = [
  { key: 'dev', name: 'Dev', where: 'example-dev' },
  { key: 'stage', name: 'Stage', where: 'example-stage' },
];
const order = environments.map((e) => e.key);

describe('the pipeline editor model', () => {
  it('draws build first, then each environment in path order', () => {
    let definition = editable({ build: {}, test: [] })!;
    definition = addStep(definition, 'script', 'Unit tests', null, order).definition;
    definition = addStep(definition, 'deploy', 'Deploy', 'stage', order).definition;
    definition = addStep(definition, 'deploy', 'Deploy', 'dev', order).definition;
    const layout = layoutOf(definition, environments, words);
    expect(layout.groups.map((group) => [group.label, group.stages])).toEqual([
      ['Build', [0, 1]],
      ['Dev', [2]],
      ['Stage', [3]],
    ]);
    expect(definition.test.map((step) => [step.key, step.needs])).toEqual([
      ['unit-tests', ['build']],
      ['deploy-stage', ['unit-tests']],
      ['deploy-dev', ['unit-tests']],
    ]);
    expect(layout.edges).toContainEqual({ from: 'build', to: 'unit-tests' });
  });

  it('removes a step and what waited on it no longer does', () => {
    let definition = editable({ test: [] })!;
    definition = addStep(definition, 'script', 'Lint', null, order).definition;
    definition = addStep(definition, 'script', 'Lint', null, order).definition;
    expect(definition.test.map((step) => step.key)).toEqual(['lint', 'lint-2']);
    definition = removeStep(definition, 'lint');
    expect(definition.test).toEqual([expect.objectContaining({ key: 'lint-2', needs: [] })]);
    definition = updateStep(definition, 'lint-2', { run: 'pnpm lint\npnpm format' });
    expect(pipelineYaml(definition, [{ kind: 'push', branch: 'main' }])).toBe(
      [
        'on:',
        '  - kind: push',
        '    branch: main',
        'test:',
        '  - name: Lint',
        '    key: lint-2',
        '    image: alpine:3.20',
        '    run: |',
        '      pnpm lint',
        '      pnpm format',
      ].join('\n'),
    );
  });

  it('does not draw a pipeline that extends a template', () => {
    expect(editable({ extends: 'acme/node@3' })).toBeNull();
  });
});
