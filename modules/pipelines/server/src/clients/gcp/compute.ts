import { z } from 'zod';
import { GcpApiError, type GcpHttp } from './http.ts';
import type { PollOptions } from './operations.ts';

/*
 * Compute Engine v1 networks, and the operation shape every Compute write answers with:
 * status DONE and an errors list rather than the common one, so it is polled here, through
 * the operation's own link (global, regional and zonal operations live at different paths).
 */

export const COMPUTE_BASE = 'https://compute.googleapis.com/compute/v1';

const networkSchema = z.object({
  name: z.string(),
  autoCreateSubnetworks: z.boolean().optional(),
  routingConfig: z.object({ routingMode: z.string().optional() }).optional(),
});

export const computeOperationSchema = z.object({
  name: z.string(),
  status: z.string(),
  selfLink: z.string().optional(),
  error: z.object({ errors: z.array(z.object({ message: z.string() })).default([]) }).optional(),
});

export type ComputeOperation = z.infer<typeof computeOperationSchema>;
export type GcpNetwork = z.infer<typeof networkSchema>;

/** Waits for a Compute write to finish; `what` names it in the error a person reads. */
export async function waitForComputeOperation(
  http: GcpHttp,
  poll: PollOptions,
  projectId: string,
  started: ComputeOperation,
  what: string,
): Promise<void> {
  let operation = started;
  const deadline = Date.now() + poll.timeoutMs;
  while (operation.status !== 'DONE') {
    if (Date.now() >= deadline) {
      throw new GcpApiError(
        COMPUTE_BASE,
        504,
        `${what} was not ready in time`,
        'DEADLINE_EXCEEDED',
      );
    }
    await poll.sleep(poll.intervalMs);
    operation = await http.send({
      url:
        operation.selfLink ??
        `${COMPUTE_BASE}/projects/${projectId}/global/operations/${operation.name}`,
      schema: computeOperationSchema,
    });
  }
  const failure = operation.error?.errors[0];
  if (failure) throw new GcpApiError(COMPUTE_BASE, 500, failure.message, null);
}

export function createComputeClient(http: GcpHttp, poll: PollOptions) {
  return {
    getNetwork(projectId: string, name: string): Promise<GcpNetwork | null> {
      return http.find({
        url: `${COMPUTE_BASE}/projects/${projectId}/global/networks/${name}`,
        schema: networkSchema,
      });
    },

    async createNetwork(projectId: string, name: string, autoSubnets: boolean): Promise<void> {
      const operation = await http.send({
        method: 'POST',
        url: `${COMPUTE_BASE}/projects/${projectId}/global/networks`,
        body: {
          name,
          autoCreateSubnetworks: autoSubnets,
          routingConfig: { routingMode: 'GLOBAL' },
        },
        schema: computeOperationSchema,
      });
      await waitForComputeOperation(http, poll, projectId, operation, `Network ${name}`);
    },
  };
}

export type ComputeClient = ReturnType<typeof createComputeClient>;
