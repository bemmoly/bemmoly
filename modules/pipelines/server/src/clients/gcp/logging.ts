import { z } from 'zod';
import type { GcpHttp } from './http.ts';

/* Cloud Logging v2: how long a project's default log bucket keeps entries. */

const BASE = 'https://logging.googleapis.com/v2';

const bucketSchema = z.object({
  name: z.string(),
  retentionDays: z.number().int().optional(),
});

const defaultBucket = (projectId: string) =>
  `projects/${projectId}/locations/global/buckets/_Default`;

export function createLoggingClient(http: GcpHttp) {
  return {
    async retentionDays(projectId: string): Promise<number | null> {
      const bucket = await http.find({
        url: `${BASE}/${defaultBucket(projectId)}`,
        schema: bucketSchema,
      });
      return bucket?.retentionDays ?? null;
    },

    async setRetentionDays(projectId: string, retentionDays: number): Promise<void> {
      await http.send({
        method: 'PATCH',
        url: `${BASE}/${defaultBucket(projectId)}`,
        query: { updateMask: 'retentionDays' },
        body: { retentionDays },
        schema: bucketSchema,
      });
    },
  };
}

export type LoggingClient = ReturnType<typeof createLoggingClient>;
