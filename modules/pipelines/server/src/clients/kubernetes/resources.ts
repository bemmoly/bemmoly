import { z } from 'zod';

/*
 * The resources Pipelines writes into a cluster, by kind (a SecretProviderClass names secret
 * versions for GKE's Secret Manager add-on to mount, never a value): where each lives in the API and
 * the loose shape every object shares. Specs and statuses stay records here; the code that
 * builds or reads one knows its fields.
 */

export const KINDS = {
  Namespace: { apiVersion: 'v1', prefix: '/api/v1', plural: 'namespaces', namespaced: false },
  Deployment: {
    apiVersion: 'apps/v1',
    prefix: '/apis/apps/v1',
    plural: 'deployments',
    namespaced: true,
  },
  Service: { apiVersion: 'v1', prefix: '/api/v1', plural: 'services', namespaced: true },
  ServiceAccount: {
    apiVersion: 'v1',
    prefix: '/api/v1',
    plural: 'serviceaccounts',
    namespaced: true,
  },
  SecretProviderClass: {
    apiVersion: 'secrets-store.csi.x-k8s.io/v1',
    prefix: '/apis/secrets-store.csi.x-k8s.io/v1',
    plural: 'secretproviderclasses',
    namespaced: true,
  },
  Gateway: {
    apiVersion: 'gateway.networking.k8s.io/v1',
    prefix: '/apis/gateway.networking.k8s.io/v1',
    plural: 'gateways',
    namespaced: true,
  },
  HTTPRoute: {
    apiVersion: 'gateway.networking.k8s.io/v1',
    prefix: '/apis/gateway.networking.k8s.io/v1',
    plural: 'httproutes',
    namespaced: true,
  },
} as const;

export type KubernetesKind = keyof typeof KINDS;

export const kubernetesObjectSchema = z.object({
  apiVersion: z.string().optional(),
  kind: z.string().optional(),
  metadata: z.object({
    name: z.string(),
    namespace: z.string().optional(),
    labels: z.record(z.string(), z.string()).default({}),
    annotations: z.record(z.string(), z.string()).default({}),
    creationTimestamp: z.string().optional(),
  }),
  spec: z.record(z.string(), z.unknown()).optional(),
  status: z.record(z.string(), z.unknown()).optional(),
});

export const kubernetesListSchema = z.object({
  items: z.array(kubernetesObjectSchema.omit({ apiVersion: true, kind: true })).default([]),
});

export type KubernetesObject = z.infer<typeof kubernetesObjectSchema>;

/** What Pipelines writes: a kind, a name, its namespace when it has one, and its body. */
export interface KubernetesManifest {
  kind: KubernetesKind;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Readonly<Record<string, string>>;
    annotations?: Readonly<Record<string, string>>;
  };
  spec?: Readonly<Record<string, unknown>>;
}

export function collectionPath(kind: KubernetesKind, namespace?: string): string {
  const info = KINDS[kind];
  if (!info.namespaced) return `${info.prefix}/${info.plural}`;
  if (!namespace) throw new Error(`A ${kind} lives in a namespace; name one`);
  return `${info.prefix}/namespaces/${encodeURIComponent(namespace)}/${info.plural}`;
}

export const objectPath = (kind: KubernetesKind, name: string, namespace?: string) =>
  `${collectionPath(kind, namespace)}/${encodeURIComponent(name)}`;
