import { z } from 'zod';
import { GcpApiError, type GcpHttp } from './http.ts';
import { operationSchema, waitForOperation, type PollOptions } from './operations.ts';
import { policySchema, withBinding } from './policy.ts';

/* Cloud Run Admin v2: services, their revisions and the traffic split between them. */

const BASE = 'https://run.googleapis.com/v2';

const conditionSchema = z.object({
  type: z.string(),
  state: z.string().optional(),
  reason: z.string().optional(),
  message: z.string().optional(),
});

const trafficTargetSchema = z.object({
  type: z.string().optional(),
  revision: z.string().optional(),
  percent: z.number().optional(),
  tag: z.string().optional(),
});

const trafficStatusSchema = trafficTargetSchema.extend({ uri: z.string().optional() });

const serviceSchema = z.object({
  name: z.string(),
  uri: z.string().optional(),
  urls: z.array(z.string()).default([]),
  etag: z.string().optional(),
  latestReadyRevision: z.string().optional(),
  latestCreatedRevision: z.string().optional(),
  template: z.record(z.string(), z.unknown()).default({}),
  traffic: z.array(trafficTargetSchema).default([]),
  trafficStatuses: z.array(trafficStatusSchema).default([]),
});

const revisionSchema = z.object({
  name: z.string(),
  conditions: z.array(conditionSchema).default([]),
  createTime: z.string().optional(),
});

const servicesPageSchema = z.object({
  services: z.array(serviceSchema).default([]),
  nextPageToken: z.string().optional(),
});

/** Cloud Run's v1 view of a revision: the one place it says which digest a tag resolved to. */
const knativeRevisionSchema = z.object({
  status: z.object({ imageDigest: z.string().optional() }).default({}),
});

export type RunService = z.infer<typeof serviceSchema>;
export type RunTrafficTarget = z.infer<typeof trafficTargetSchema>;
export type RunRevision = z.infer<typeof revisionSchema>;

/** "projects/acme-commerce-prod/locations/asia-south1/services/checkout-api". */
export const runServiceName = (projectId: string, region: string, service: string) =>
  `projects/${projectId}/locations/${region}/services/${service}`;

export const REVISION_TARGET = 'TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION';
export const LATEST_TARGET = 'TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST';

export function createCloudRunClient(http: GcpHttp, poll: PollOptions) {
  const finish = async (operation: z.infer<typeof operationSchema>) =>
    serviceSchema.parse(await waitForOperation(http, BASE, operation, poll));

  return {
    getService(name: string): Promise<RunService | null> {
      return http.find({ url: `${BASE}/${name}`, schema: serviceSchema });
    },

    /** Every service in one project and region, page by page. */
    async listServices(projectId: string, region: string): Promise<RunService[]> {
      const services: RunService[] = [];
      let pageToken: string | undefined;
      do {
        const page = await http.send({
          url: `${BASE}/projects/${projectId}/locations/${region}/services`,
          query: { pageSize: 100, ...(pageToken ? { pageToken } : {}) },
          schema: servicesPageSchema,
        });
        services.push(...page.services);
        pageToken = page.nextPageToken || undefined;
      } while (pageToken);
      return services;
    },

    /**
     * The image a revision runs, by digest ("…/cart-api@sha256:…"), even when it was deployed
     * by tag: v2 keeps the tag as written, v1 says what it resolved to.
     */
    async revisionDigest(
      projectId: string,
      region: string,
      revision: string,
    ): Promise<string | null> {
      const found = await http.find({
        url: `https://${region}-run.googleapis.com/apis/serving.knative.dev/v1/namespaces/${projectId}/revisions/${revision}`,
        schema: knativeRevisionSchema,
      });
      return found?.status.imageDigest ?? null;
    },

    async createService(
      parent: string,
      serviceId: string,
      service: { template: Record<string, unknown>; traffic: RunTrafficTarget[] },
    ): Promise<RunService> {
      const operation = await http.send({
        method: 'POST',
        url: `${BASE}/${parent}/services`,
        query: { serviceId },
        body: service,
        schema: operationSchema,
      });
      return finish(operation);
    },

    /** Replaces the template and traffic; the etag stops a concurrent change being lost. */
    async updateService(
      service: Pick<RunService, 'name' | 'etag' | 'template' | 'traffic'>,
    ): Promise<RunService> {
      const operation = await http.send({
        method: 'PATCH',
        url: `${BASE}/${service.name}`,
        body: {
          ...(service.etag ? { etag: service.etag } : {}),
          template: service.template,
          traffic: service.traffic,
        },
        schema: operationSchema,
      });
      return finish(operation);
    },

    /** Lets anyone call the service; a no-op when it is public already. */
    async allowPublicInvoker(name: string): Promise<void> {
      const policy = await http.send({ url: `${BASE}/${name}:getIamPolicy`, schema: policySchema });
      const changed = withBinding(policy, 'roles/run.invoker', 'allUsers');
      if (!changed) return;
      await http.send({
        method: 'POST',
        url: `${BASE}/${name}:setIamPolicy`,
        body: { policy: changed },
        schema: policySchema,
      });
    },

    getRevision(name: string): Promise<RunRevision | null> {
      return http.find({ url: `${BASE}/${name}`, schema: revisionSchema });
    },

    /** The whole service and every revision; gone already counts as deleted. */
    async deleteService(name: string): Promise<void> {
      try {
        const operation = await http.send({
          method: 'DELETE',
          url: `${BASE}/${name}`,
          schema: operationSchema,
        });
        await waitForOperation(http, BASE, operation, poll);
      } catch (error) {
        if (error instanceof GcpApiError && error.status === 404) return;
        throw error;
      }
    },

    async deleteRevision(name: string): Promise<void> {
      const operation = await http.send({
        method: 'DELETE',
        url: `${BASE}/${name}`,
        schema: operationSchema,
      });
      await waitForOperation(http, BASE, operation, poll);
    },
  };
}

export type CloudRunClient = ReturnType<typeof createCloudRunClient>;
