import { z } from 'zod';
import { GcpApiError, type GcpHttp } from './http.ts';

/*
 * Google's long-running operations: most writes answer with an operation that finishes
 * later. Each is polled at a steady interval up to a bounded wait, so a stuck operation
 * becomes an error a person can read instead of a request that never ends.
 */

export const operationSchema = z.object({
  name: z.string(),
  done: z.boolean().optional(),
  error: z.object({ code: z.number().optional(), message: z.string() }).optional(),
  response: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type GcpOperation = z.infer<typeof operationSchema>;

export interface PollOptions {
  /** Longest total wait before giving up. */
  timeoutMs: number;
  intervalMs: number;
  sleep: (ms: number) => Promise<void>;
}

export const DEFAULT_POLL: PollOptions = {
  timeoutMs: 5 * 60_000,
  intervalMs: 2_000,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Waits for `operation` (already started) to finish and answers its response. `apiBase` is
 * the API's versioned root, since an operation's name is relative to it.
 */
export async function waitForOperation(
  http: GcpHttp,
  apiBase: string,
  operation: GcpOperation,
  poll: PollOptions,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + poll.timeoutMs;
  let current = operation;
  while (!current.done) {
    if (Date.now() >= deadline) {
      throw new GcpApiError(
        `${apiBase}/${current.name}`,
        504,
        `Google Cloud did not finish ${current.name} in ${Math.round(poll.timeoutMs / 1000)} seconds`,
        'DEADLINE_EXCEEDED',
      );
    }
    await poll.sleep(poll.intervalMs);
    current = await http.send({ url: `${apiBase}/${current.name}`, schema: operationSchema });
  }
  if (current.error) {
    throw new GcpApiError(`${apiBase}/${current.name}`, 500, current.error.message, null);
  }
  return current.response ?? {};
}
