import { describe, expect, it } from 'vitest';
import { resolvePipeline } from '../orchestrator/resolve.ts';
import { builtInTemplates, definitionFrom, emptyDefinition } from './templates.ts';

const dev = { key: 'dev', name: 'Dev', approvalRule: false };
const stage = { key: 'stage', name: 'Stage', approvalRule: false };
const production = { key: 'production', name: 'Production', approvalRule: true };

const resolve = (definition: ReturnType<typeof definitionFrom>) =>
  resolvePipeline(definition, async () => null, {
    application: 'orders',
    defaultTimeoutMinutes: 30,
  });

describe('built-in templates', () => {
  it('ships four, the path one suggested, each leaving out environments that do not exist', () => {
    const items = builtInTemplates({ environments: [], path: '', buildPool: null });
    expect(items.map((item) => item.key)).toEqual([
      'dev-stage-production',
      'one-environment',
      'cloud-run-job',
      'pull-request-checks',
    ]);
    expect(items.filter((item) => item.suggested).map((item) => item.key)).toEqual([
      'dev-stage-production',
    ]);
    const path = items[0];
    expect(path?.groups.map((group) => group.name)).toEqual(['Build']);
    expect(path?.leftOut).toEqual(['Dev', 'Stage', 'Production']);
  });

  it('draws one group per environment in path order and stops before one that needs approval', () => {
    const [path] = builtInTemplates({
      environments: [dev, stage, production],
      path: '',
      buildPool: null,
    });
    expect(path?.groups).toEqual([
      { name: 'Build', environment: null, steps: ['Build image', 'Unit tests'] },
      { name: 'Dev', environment: 'dev', steps: ['Deploy', 'Integration tests'] },
      { name: 'Stage', environment: 'stage', steps: ['Deploy', 'Smoke tests'] },
      { name: 'Production', environment: 'production', steps: ['Promote when approved'] },
    ]);
    expect(path?.leftOut).toEqual([]);
  });

  it('makes a pipeline whose jobs carry their environment, building in Cloud Build when asked', async () => {
    const definition = definitionFrom('dev-stage-production', {
      environments: [dev, stage, production],
      path: 'services/orders',
      buildPool: 'cloud-build-dev',
    });
    expect(definition.build).toMatchObject({ context: 'services/orders', pool: 'cloud-build-dev' });
    const resolved = await resolve(definition);
    expect(
      resolved.jobs.map((job) => [job.key, job.kind, job.environment, job.needs.join(',')]),
    ).toEqual([
      ['build', 'build', null, ''],
      ['unit-tests', 'test', null, 'build'],
      ['deploy-dev', 'deploy', 'dev', 'unit-tests'],
      ['integration-tests-dev', 'test', 'dev', 'deploy-dev'],
      ['deploy-stage', 'deploy', 'stage', 'integration-tests-dev'],
      ['smoke-tests-stage', 'test', 'stage', 'deploy-stage'],
    ]);
  });

  it('checks pull requests without deploying, and starts empty when asked', async () => {
    const checks = await resolve(
      definitionFrom('pull-request-checks', { environments: [dev], path: '', buildPool: null }),
    );
    expect(checks.jobs.every((job) => job.kind !== 'deploy')).toBe(true);
    expect(emptyDefinition().test).toEqual([]);
  });
});
