import { z } from 'zod';

/*
 * The local traffic splitter's admin port: read and set the routes, read the counters it
 * keeps per revision, and probe a revision before traffic goes to it. Every call has a
 * short timeout; the splitter runs on the same machine.
 */

const TIMEOUT_MS = 5_000;

export const splitterRouteSchema = z.object({
  revision: z.string(),
  upstream: z.string(),
  percent: z.number(),
});

const routesSchema = z.object({ routes: z.array(splitterRouteSchema) });

export const splitterMetricsSchema = z.object({
  requests: z.number(),
  errors: z.number(),
  errorRate: z.number().nullable(),
  p95: z.number().nullable(),
  /** [bucket start ms, error rate, p95 ms or null]. */
  series: z.array(z.tuple([z.number(), z.number(), z.number().nullable()])),
});

export type SplitterRoute = z.infer<typeof splitterRouteSchema>;
export type SplitterMetrics = z.infer<typeof splitterMetricsSchema>;

export function createSplitterClient(baseUrl: string) {
  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(`${baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  }
  async function json<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
    const response = await call(path, init);
    if (!response.ok)
      throw new Error(`The traffic splitter answered ${response.status} to ${path}`);
    return schema.parse(await response.json());
  }
  return {
    routes: async () => (await json('/routes', routesSchema)).routes,
    setRoutes: async (routes: SplitterRoute[]) =>
      (
        await json('/routes', routesSchema, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ routes }),
        })
      ).routes,
    metrics: (input: { revision?: string; from: Date; to: Date }) =>
      json(
        `/metrics?from=${input.from.getTime()}&to=${input.to.getTime()}${
          input.revision ? `&revision=${encodeURIComponent(input.revision)}` : ''
        }`,
        splitterMetricsSchema,
      ),
    /** Whether a revision answers /healthz through the splitter's network. */
    async probe(upstream: string): Promise<boolean> {
      try {
        return (await call(`/probe?upstream=${encodeURIComponent(upstream)}`)).ok;
      } catch {
        return false;
      }
    },
  };
}

export type SplitterClient = ReturnType<typeof createSplitterClient>;
