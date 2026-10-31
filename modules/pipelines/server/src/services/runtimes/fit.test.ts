import { describe, expect, it } from 'vitest';
import { runtimeOfCluster, runtimeProblem, type FitInput } from './fit.ts';

/* Whether an application can deploy on its runtime, in the sentence a person reads. */

const base: FitInput = {
  runtime: 'gke-autopilot',
  application: 'cart-api',
  environment: 'dev',
  cluster: { name: 'bemmoly-dev', origin: 'created', mode: 'autopilot', status: 'ready' },
  supported: true,
};

describe('runtime fit', () => {
  it('lets Cloud Run deploy anywhere, cluster or not', () => {
    expect(
      runtimeProblem({ ...base, runtime: 'cloud-run', cluster: null, supported: false }),
    ).toBeNull();
  });

  it('lets GKE deploy when the cluster is the right kind and ready', () => {
    expect(runtimeProblem(base)).toBeNull();
    expect(
      runtimeProblem({
        ...base,
        runtime: 'attached-cluster',
        cluster: { ...base.cluster!, origin: 'attached' },
      }),
    ).toBeNull();
  });

  it('says what to do when there is no cluster, the wrong one, or one not ready', () => {
    expect(runtimeProblem({ ...base, cluster: null })).toBe(
      'dev has no cluster yet. Create or attach one in Platform › Clusters, or switch cart-api back to Cloud Run',
    );
    expect(runtimeProblem({ ...base, runtime: 'gke-standard' })).toBe(
      "dev's cluster bemmoly-dev is GKE Autopilot, not GKE Standard. Choose GKE Autopilot for cart-api, or Cloud Run",
    );
    expect(runtimeProblem({ ...base, cluster: { ...base.cluster!, status: 'creating' } })).toMatch(
      /still being created/,
    );
    expect(runtimeProblem({ ...base, cluster: { ...base.cluster!, status: 'failed' } })).toMatch(
      /failed its last check/,
    );
    expect(runtimeProblem({ ...base, supported: false })).toBe(
      'dev cannot run applications on GKE Autopilot yet. Switch cart-api back to Cloud Run there',
    );
  });

  it('names a cluster by the runtime it serves', () => {
    expect(runtimeOfCluster({ origin: 'created', mode: 'standard' })).toBe('gke-standard');
    expect(runtimeOfCluster({ origin: 'attached', mode: 'standard' })).toBe('attached-cluster');
  });
});
