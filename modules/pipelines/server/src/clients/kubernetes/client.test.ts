import { describe, expect, it } from 'vitest';
import { createReplayTransport } from '../../testing/gcp-replay.ts';
import { createKubernetesClient, KubernetesApiError } from './index.ts';

/* The Kubernetes client against written answers: paths, apply, lists, errors. */

const KUBE = 'https://34.118.10.2';

const client = (exchanges: Parameters<typeof createReplayTransport>[0]) => {
  const replay = createReplayTransport(exchanges);
  return {
    replay,
    kube: createKubernetesClient({
      endpoint: '34.118.10.2',
      tokens: { token: async () => 'ya29.recorded' },
      transport: replay.transport,
    }),
  };
};

describe('the Kubernetes client', () => {
  it('applies by server-side apply and reads back what the server says', async () => {
    const { kube, replay } = client([
      {
        method: 'PATCH',
        url: `${KUBE}/api/v1/namespaces/shop/services/web?fieldManager=bemmoly-pipelines&force=true`,
        body: { apiVersion: 'v1', kind: 'Service', metadata: { name: 'web', namespace: 'shop' } },
        response: { metadata: { name: 'web', namespace: 'shop', uid: 'u1' } },
      },
    ]);
    const applied = await kube.apply({
      kind: 'Service',
      metadata: { name: 'web', namespace: 'shop' },
    });
    expect(applied.metadata.name).toBe('web');
    replay.verify({ allUsed: true });
  });

  it('answers null for a missing object and lists by label', async () => {
    const { kube } = client([
      {
        method: 'GET',
        url: `${KUBE}/apis/apps/v1/namespaces/shop/deployments/gone`,
        status: 404,
        response: { kind: 'Status', reason: 'NotFound' },
      },
      {
        method: 'GET',
        url: `${KUBE}/apis/apps/v1/namespaces/shop/deployments?labelSelector=app%3Dweb`,
        response: { items: [{ metadata: { name: 'web-1' } }] },
      },
    ]);
    expect(await kube.get('Deployment', 'gone', 'shop')).toBeNull();
    expect((await kube.list('Deployment', 'shop', 'app=web')).map((d) => d.metadata.name)).toEqual([
      'web-1',
    ]);
  });

  it('turns a refusal into an error that carries the server reason', async () => {
    const { kube } = client([
      {
        method: 'GET',
        url: `${KUBE}/api/v1/namespaces/shop`,
        status: 403,
        response: {
          kind: 'Status',
          reason: 'Forbidden',
          message: 'namespaces "shop" is forbidden',
        },
      },
    ]);
    const error = await kube.get('Namespace', 'shop').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(KubernetesApiError);
    expect(error).toMatchObject({
      status: 403,
      reason: 'Forbidden',
      message: 'namespaces "shop" is forbidden',
    });
  });

  it('asks the server whether it may act, and which resources a group serves', async () => {
    const { kube } = client([
      {
        method: 'POST',
        url: `${KUBE}/apis/authorization.k8s.io/v1/selfsubjectaccessreviews`,
        body: {
          spec: { resourceAttributes: { verb: 'create', group: 'apps', resource: 'deployments' } },
        },
        response: { status: { allowed: true } },
      },
      {
        method: 'GET',
        url: `${KUBE}/apis/gateway.networking.k8s.io/v1`,
        status: 404,
        response: {},
      },
    ]);
    expect(await kube.can({ verb: 'create', group: 'apps', resource: 'deployments' })).toBe(true);
    expect(await kube.served('gateway.networking.k8s.io/v1')).toBeNull();
  });
});
