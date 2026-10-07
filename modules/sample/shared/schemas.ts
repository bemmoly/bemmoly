import { z } from 'zod';

export const sampleItemSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  createdAt: z.iso.datetime(),
});

export const sampleItemsResponseSchema = z.object({ items: z.array(sampleItemSchema) });

export const createSampleItemBodySchema = z.object({
  label: z.string().trim().min(1).max(200),
});

export const createSamplePingBodySchema = z.object({
  /** Same key twice within a day enqueues one job. */
  idempotencyKey: z.string().min(1).max(128).optional(),
});

export const samplePingResponseSchema = z.object({
  jobId: z.string().nullable(),
  deduplicated: z.boolean(),
});

export const sampleGreetingResponseSchema = z.object({ greeting: z.string() });

export type SampleItem = z.infer<typeof sampleItemSchema>;
export type SamplePingResponse = z.infer<typeof samplePingResponseSchema>;
