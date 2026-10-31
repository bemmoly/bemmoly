import { z } from 'zod';

/*
 * The resources Pipelines writes into a cluster, by kind (a SecretProviderClass names secret
 * versions for GKE's Secret Manager add-on to mount or a SecretSync to copy into a Kubernetes
 * Secret, never a value): where each lives in the API and
 * the loose shape every object shares. Specs and statuses stay records here; the code that
 * builds or reads one knows its fields. A runner pod's launch token is the one Secret
 * Pipelines writes, owned by the pod's Job so it goes when the Job does.
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
  Secret: { apiVersion: 'v1', prefix: '/api/v1', plural: 'secrets', namespaced: true },
  Pod: { apiVersion: 'v1', prefix: '/api/v1', plural: 'pods', namespaced: true },
  Job: { apiVersion: 'batch/v1', prefix: '/apis/batch/v1', plural: 'jobs', namespaced: true },
  PriorityClass: {
    apiVersion: 'scheduling.k8s.io/v1',
    prefix: '/apis/scheduling.k8s.io/v1',
    plural: 'priorityclasses',
    namespaced: false,
  },
  SecretProviderClass: {
    apiVersion: 'secrets-store.csi.x-k8s.io/v1',
    prefix: '/apis/secrets-store.csi.x-k8s.io/v1',
    plural: 'secretproviderclasses',
    namespaced: true,
  },
  HorizontalPodAutoscaler: {
    apiVersion: 'autoscaling/v2',
    prefix: '/apis/autoscaling/v2',
    plural: 'horizontalpodautoscalers',
    namespaced: true,
  },
  PodDisruptionBudget: {
    apiVersion: 'policy/v1',
    prefix: '/apis/policy/v1',
    plural: 'poddisruptionbudgets',
    namespaced: true,
  },
  SecretSync: {
    apiVersion: 'secret-sync.gke.io/v1',
    prefix: '/apis/secret-sync.gke.io/v1',
    plural: 'secretsyncs',
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
    uid: z.string().optional(),
  }),
  spec: z.record(z.string(), z.unknown()).optional(),
  status: z.record(z.string(), z.unknown()).optional(),
});

export const kubernetesListSchema = z.object({
  items: z.array(kubernetesObjectSchema.omit({ apiVersion: true, kind: true })).default([]),
});

export type KubernetesObject = z.infer<typeof kubernetesObjectSchema>;

/** The object another one belongs to; Kubernetes deletes it when its owner goes. */
export interface OwnerReference {
  apiVersion: string;
  kind: string;
  name: string;
  uid: string;
}

/**
 * What Pipelines writes: a kind, a name, its namespace when it has one, and its body. Most
 * kinds have a spec; a Secret has its string data and a PriorityClass its fields at the top.
 */
export interface KubernetesManifest {
  kind: KubernetesKind;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Readonly<Record<string, string>>;
    annotations?: Readonly<Record<string, string>>;
    ownerReferences?: readonly OwnerReference[];
  };
  spec?: Readonly<Record<string, unknown>>;
  type?: string;
  stringData?: Readonly<Record<string, string>>;
  value?: number;
  preemptionPolicy?: string;
  globalDefault?: boolean;
  description?: string;
}

export function collectionPath(kind: KubernetesKind, namespace?: string): string {
  const info = KINDS[kind];
  if (!info.namespaced) return `${info.prefix}/${info.plural}`;
  if (!namespace) throw new Error(`A ${kind} lives in a namespace; name one`);
  return `${info.prefix}/namespaces/${encodeURIComponent(namespace)}/${info.plural}`;
}

export const objectPath = (kind: KubernetesKind, name: string, namespace?: string) =>
  `${collectionPath(kind, namespace)}/${encodeURIComponent(name)}`;
