import { z } from 'zod';
import type { GcpHttp } from './http.ts';
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
