import { z } from 'zod';
import type { GcpHttp } from './http.ts';
import { operationSchema, waitForOperation, type PollOptions } from './operations.ts';

/* Service Usage v1: which Google APIs a project has turned on, and turning more on. */

const BASE = 'https://serviceusage.googleapis.com/v1';

const serviceSchema = z.object({
  name: z.string(),
  config: z.object({ name: z.string() }).optional(),
  state: z.string().optional(),
});

export function createServiceUsageClient(http: GcpHttp, poll: PollOptions) {
  return {
    /** "run.googleapis.com", … for every enabled API. */
    async listEnabled(projectId: string): Promise<string[]> {
      const enabled: string[] = [];
      let pageToken: string | undefined;
      do {
        const page = await http.send({
          url: `${BASE}/projects/${projectId}/services`,
          query: { filter: 'state:ENABLED', pageSize: 200, pageToken },
          schema: z.object({
            services: z.array(serviceSchema).default([]),
            nextPageToken: z.string().optional(),
          }),
        });
        for (const service of page.services) {
          enabled.push(service.config?.name ?? service.name.split('/').pop() ?? service.name);
        }
        pageToken = page.nextPageToken || undefined;
      } while (pageToken);
      return enabled;
    },

    /** Enables up to 20 APIs at once (the API's own batch limit). */
    async enable(projectId: string, serviceIds: readonly string[]): Promise<void> {
      for (let start = 0; start < serviceIds.length; start += 20) {
        const operation = await http.send({
          method: 'POST',
          url: `${BASE}/projects/${projectId}/services:batchEnable`,
          body: { serviceIds: serviceIds.slice(start, start + 20) },
          schema: operationSchema,
        });
        await waitForOperation(http, BASE, operation, poll);
      }
    },
  };
}

export type ServiceUsageClient = ReturnType<typeof createServiceUsageClient>;
