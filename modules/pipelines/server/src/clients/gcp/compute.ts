import { z } from 'zod';
import { GcpApiError, type GcpHttp } from './http.ts';
import type { PollOptions } from './operations.ts';

/*
 * Compute Engine v1, networks only. Compute has its own operation shape (status DONE and an
 * errors list) rather than the common one, so it is polled here.
 */

const BASE = 'https://compute.googleapis.com/compute/v1';

const networkSchema = z.object({
  name: z.string(),
  autoCreateSubnetworks: z.boolean().optional(),
  routingConfig: z.object({ routingMode: z.string().optional() }).optional(),
});

const computeOperationSchema = z.object({
  name: z.string(),
  status: z.string(),
  error: z.object({ errors: z.array(z.object({ message: z.string() })).default([]) }).optional(),
});

export type GcpNetwork = z.infer<typeof networkSchema>;

export function createComputeClient(http: GcpHttp, poll: PollOptions) {
  return {
    getNetwork(projectId: string, name: string): Promise<GcpNetwork | null> {
      return http.find({
        url: `${BASE}/projects/${projectId}/global/networks/${name}`,
        schema: networkSchema,
      });
    },

    async createNetwork(projectId: string, name: string, autoSubnets: boolean): Promise<void> {
      let operation = await http.send({
        method: 'POST',
        url: `${BASE}/projects/${projectId}/global/networks`,
        body: {
          name,
          autoCreateSubnetworks: autoSubnets,
          routingConfig: { routingMode: 'GLOBAL' },
        },
        schema: computeOperationSchema,
      });
      const deadline = Date.now() + poll.timeoutMs;
      while (operation.status !== 'DONE') {
        if (Date.now() >= deadline) {
          throw new GcpApiError(BASE, 504, `Network ${name} was not ready in time`, null);
        }
        await poll.sleep(poll.intervalMs);
        operation = await http.send({
          url: `${BASE}/projects/${projectId}/global/operations/${operation.name}`,
          schema: computeOperationSchema,
        });
      }
      const failure = operation.error?.errors[0];
      if (failure) throw new GcpApiError(BASE, 500, failure.message, null);
    },
  };
}

export type ComputeClient = ReturnType<typeof createComputeClient>;
