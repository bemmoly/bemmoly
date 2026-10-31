import { describe, expect, it } from 'vitest';
import { fillReferences } from './addresses.ts';
import { fileLayersOf, resolveDeploySettings } from './resolve.ts';

/*
 * Which deploy setting wins, and what each runtime does when nothing sets one: Pipelines,
 * then the file's environment entry, then the file, then the runtime's default.
 */

const resolve = (
  runtime: 'cloud-run' | 'gke-autopilot',
  environmentClass: 'dev' | 'staging' | 'prod',
  config: Record<string, unknown> = {},
  pipelines = {},
) => {
  const key = environmentClass === 'prod' ? 'prod' : 'stage';
  const { file, fileEnvironment, extras } = fileLayersOf(config, key);
  return resolveDeploySettings({
    layers: { pipelines, file, fileEnvironment },
    runtime,
    environmentClass,
    environmentKey: key,
    extras,
  });
};

const valueOf = (resolution: ReturnType<typeof resolve>, field: string) =>
  resolution.entries.find((entry) => entry.field === field);

describe('deploy settings defaults', () => {
  it('starts Cloud Run at zero instances with secrets as variables', () => {
    const { settings, disruptionBudget } = resolve('cloud-run', 'staging');
    expect(settings.scaling).toEqual({ min: 0, max: null, concurrency: null, cpuTarget: null });
    expect(settings.secretsAs).toBe('env');
    expect(disruptionBudget).toBe(false);
  });

  it('runs two GKE replicas in Prod with a budget of one, and one elsewhere', () => {
    const prod = resolve('gke-autopilot', 'prod');
    expect(prod.settings.scaling).toEqual({ min: 2, max: 10, concurrency: null, cpuTarget: 70 });
    expect(prod.settings.maxUnavailable).toBe(1);
    expect(prod.disruptionBudget).toBe(true);
    const stage = resolve('gke-autopilot', 'staging');
    expect(stage.settings.scaling.min).toBe(1);
    expect(stage.settings.maxUnavailable).toBeNull();
  });

  it('says a setting the runtime does not have does not apply', () => {
    const run = resolve('cloud-run', 'prod', {}, { scaling: { cpuTarget: 50 } });
    expect(valueOf(run, 'scaling.cpuTarget')).toMatchObject({ applies: false, value: null });
    const gke = resolve('gke-autopilot', 'prod', {}, { scaling: { concurrency: 50 } });
    expect(valueOf(gke, 'scaling.concurrency')).toMatchObject({ applies: false, value: null });
  });
});

describe('deploy settings precedence', () => {
  const config = {
    deploy: {
      port: '3000',
      scaling: { min: 1, max: 4 },
      healthcheck: { path: '/healthz', timeoutSeconds: 3 },
      environments: { prod: { scaling: { min: 3 }, healthcheck: { ready: '/ready' } } },
    },
  };

  it('takes Pipelines first, then the environment entry, then the file', () => {
    const resolution = resolve('gke-autopilot', 'prod', config, { scaling: { max: 8 } });
    expect(valueOf(resolution, 'scaling.max')).toMatchObject({ value: 8, source: 'pipelines' });
    expect(valueOf(resolution, 'scaling.min')).toMatchObject({
      value: 3,
      source: 'file-environment',
    });
    expect(valueOf(resolution, 'port')).toMatchObject({ value: 3000, source: 'file' });
    expect(valueOf(resolution, 'healthcheck.ready')).toMatchObject({ value: '/ready' });
    expect(valueOf(resolution, 'secretsAs')).toMatchObject({ value: 'env', source: 'default' });
    expect(resolution.settings.healthcheck).toEqual({
      path: '/healthz',
      ready: '/ready',
      timeoutSeconds: 3,
    });
  });

  it('reads another environment without the Prod entry', () => {
    const resolution = resolve('cloud-run', 'staging', config);
    expect(resolution.settings.scaling).toMatchObject({ min: 1, max: 4 });
    expect(resolution.settings.healthcheck.ready).toBeNull();
  });

  it('drops a malformed file value instead of failing the deploy', () => {
    const resolution = resolve('cloud-run', 'staging', {
      deploy: { port: 'eighty', resources: { memory: 'lots' } },
    });
    expect(resolution.settings.port).toBeNull();
    expect(resolution.settings.resources.memory).toBeNull();
  });

  it('says in one sentence when min is above max', () => {
    expect(resolve('gke-autopilot', 'prod', {}, { scaling: { min: 5, max: 3 } }).problem).toBe(
      'scaling.min (5) is above scaling.max (3) in prod. Lower min or raise max',
    );
  });
});

describe('application addresses in variables', () => {
  const addresses = new Map([
    ['cart-api@prod', { url: 'http://cart-api.shop.svc.cluster.local:8080', publicUrl: null }],
  ]);

  it('fills in the address the application answers on in that environment', () => {
    expect(fillReferences('${{ apps.cart-api.url }}/v1', 'prod', addresses)).toEqual({
      value: 'http://cart-api.shop.svc.cluster.local:8080/v1',
      problem: null,
    });
  });

  it('names an application that is not there yet, so callees deploy first', () => {
    expect(fillReferences('${{ apps.cart-api.url }}', 'stage', addresses).problem).toBe(
      'cart-api is not deployed to stage yet. Deploy cart-api there first',
    );
    expect(fillReferences('${{apps.cart-api.publicUrl}}', 'prod', addresses).problem).toMatch(
      /has no public address in prod yet/,
    );
  });
});
