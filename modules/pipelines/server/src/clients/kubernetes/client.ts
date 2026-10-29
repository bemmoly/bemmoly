import { z } from 'zod';
import { createKubernetesHttp, type KubernetesHttpOptions } from './http.ts';
import {
  KINDS,
  kubernetesListSchema,
  kubernetesObjectSchema,
  objectPath,
  collectionPath,
  type KubernetesKind,
  type KubernetesManifest,
  type KubernetesObject,
} from './resources.ts';

/*
 * A small Kubernetes client: namespaces, apps/v1 Deployments, Services, and the Gateway API's
 * Gateways and HTTPRoutes. Every write is a server-side apply under one field manager, so a
 * repeat is a no-op and fields other tools own are left alone. It also answers the two
 * questions an attach check asks: is an API group served, and may I do this.
 */

export const FIELD_MANAGER = 'bemmoly-pipelines';

const reviewSchema = z.object({
  status: z.object({ allowed: z.boolean().default(false), reason: z.string().optional() }).default({
    allowed: false,
  }),
});

const groupSchema = z.object({
  resources: z.array(z.object({ name: z.string() })).default([]),
});

export interface AccessQuestion {
  verb: string;
  /** "" for the core group, "apps", "gateway.networking.k8s.io". */
  group: string;
  resource: string;
  namespace?: string;
}

export function createKubernetesClient(options: KubernetesHttpOptions) {
  const http = createKubernetesHttp(options);
  return {
    /** Creates or updates it to match; fields this manager set before and left out go away. */
    apply(manifest: KubernetesManifest): Promise<KubernetesObject> {
      const info = KINDS[manifest.kind];
      return http.send({
        method: 'PATCH',
        path: objectPath(manifest.kind, manifest.metadata.name, manifest.metadata.namespace),
        query: { fieldManager: FIELD_MANAGER, force: 'true' },
        contentType: 'application/apply-patch+yaml',
        body: { ...manifest, apiVersion: info.apiVersion },
        schema: kubernetesObjectSchema,
      });
    },

    get(kind: KubernetesKind, name: string, namespace?: string): Promise<KubernetesObject | null> {
      return http.find({ path: objectPath(kind, name, namespace), schema: kubernetesObjectSchema });
    },

    async list(
      kind: KubernetesKind,
      namespace: string | undefined,
      labelSelector: string,
    ): Promise<KubernetesObject[]> {
      const page = await http.find({
        path: collectionPath(kind, namespace),
        query: { labelSelector },
        schema: kubernetesListSchema,
      });
      return page?.items ?? [];
    },

    /** Gone already counts as deleted. */
    async remove(kind: KubernetesKind, name: string, namespace?: string): Promise<void> {
      await http.find({
        method: 'DELETE',
        path: objectPath(kind, name, namespace),
        body: { apiVersion: 'v1', kind: 'DeleteOptions', propagationPolicy: 'Background' },
        schema: z.unknown(),
      });
    },

    /** The resources an API group version serves; null when the cluster does not serve it. */
    async served(groupVersion: string): Promise<string[] | null> {
      const found = await http.find({ path: `/apis/${groupVersion}`, schema: groupSchema });
      return found ? found.resources.map((resource) => resource.name) : null;
    },

    /** Whether the identity this client acts as may do it, by a SelfSubjectAccessReview. */
    async can(question: AccessQuestion): Promise<boolean> {
      const review = await http.send({
        method: 'POST',
        path: '/apis/authorization.k8s.io/v1/selfsubjectaccessreviews',
        body: {
          apiVersion: 'authorization.k8s.io/v1',
          kind: 'SelfSubjectAccessReview',
          spec: {
            resourceAttributes: {
              verb: question.verb,
              group: question.group,
              resource: question.resource,
              ...(question.namespace ? { namespace: question.namespace } : {}),
            },
          },
        },
        schema: reviewSchema,
      });
      return review.status.allowed;
    },
  };
}

export type KubernetesClient = ReturnType<typeof createKubernetesClient>;
