import type { ServiceRow, ServiceRunning } from '@bemmoly/module-pipelines/shared';
import { describe, expect, it } from 'vitest';
import { byHealth, healthOf, sectionsOf } from './shape.ts';

const running = (environment: string, state: ServiceRunning['state']): ServiceRunning => ({
  environment,
  version: '1.0.0',
  releaseId: null,
  commitSha: null,
  message: null,
  state,
  movingVersion: null,
  trafficPercent: 100,
  deployedAt: null,
  deployedBy: null,
  pending: null,
});

const service = (key: string, domain: string, team: string | null, states: ServiceRunning[]) =>
  ({
    id: key,
    key,
    name: key,
    kind: 'container-service',
    path: key,
    repository: null,
    domain: { key: domain, name: domain, color: 'epic-1' },
    team: team ? { id: team, name: team } : null,
    running: states,
    lastRun: null,
  }) satisfies ServiceRow;

describe('the services list', () => {
  const items = [
    service('api', 'shop', 'web', [running('dev', 'failed'), running('prod', 'idle')]),
    service('worker', 'shop', null, [running('dev', 'canary')]),
    service('jobs', 'ops', 'web', [running('dev', 'idle')]),
    service('new', 'ops', null, []),
  ];

  it('reads a failure anywhere as failing, a rollout as deploying', () => {
    expect(items.map(healthOf)).toEqual(['failing', 'deploying', 'healthy', null]);
    expect(byHealth(items, 'healthy').map((item) => item.key)).toEqual(['jobs']);
    expect(byHealth(items, 'any')).toHaveLength(4);
  });

  it('groups by domain in order, and by team with no team last', () => {
    expect(sectionsOf(items, 'domain', 'No team').map((section) => section.key)).toEqual([
      'shop',
      'ops',
    ]);
    const teams = sectionsOf(items, 'team', 'No team');
    expect(teams.map((section) => [section.name, section.items.length])).toEqual([
      ['web', 2],
      ['No team', 2],
    ]);
  });
});
