import { describe, expect, it } from 'vitest';
import { clusterBodyOf, clusterDefaults, clusterProblems, NEW_CLUSTER } from './cluster-draft.ts';

const environment = {
  key: 'dev',
  region: null,
  cloudAccount: { id: 'a1', externalId: 'acme-dev', name: 'Dev' },
};
const defaults = clusterDefaults(environment, { region: 'europe-west1' });

describe('a new cluster', () => {
  it('starts from the environment: its name, project and region', () => {
    expect(defaults).toEqual({
      name: 'bemmoly-dev',
      projectId: 'acme-dev',
      location: 'europe-west1',
    });
    expect(clusterProblems(NEW_CLUSTER, defaults, false).size).toBe(0);
    expect(clusterBodyOf(NEW_CLUSTER, defaults, 'e1', false)).toEqual({
      origin: 'created',
      environmentId: 'e1',
      mode: 'autopilot',
      name: 'bemmoly-dev',
    });
  });

  it('attaches what was typed, with a Gateway only when both parts are named', () => {
    const draft = { ...NEW_CLUSTER, name: 'shop-prod', gatewayNamespace: 'infra' };
    expect(clusterProblems(draft, defaults, true)).toEqual(new Set(['gateway']));
    const named = { ...draft, gatewayName: 'shared' };
    expect(clusterProblems(named, defaults, true).size).toBe(0);
    expect(clusterBodyOf(named, defaults, 'e1', true)).toEqual({
      origin: 'attached',
      environmentId: 'e1',
      projectId: 'acme-dev',
      location: 'europe-west1',
      name: 'shop-prod',
      gateway: { namespace: 'infra', name: 'shared' },
    });
  });

  it('flags names, projects and locations GKE would refuse', () => {
    const draft = { ...NEW_CLUSTER, name: '9-bad', projectId: 'X', location: 'nowhere' };
    expect(clusterProblems(draft, defaults, true)).toEqual(
      new Set(['name', 'projectId', 'location']),
    );
  });
});
