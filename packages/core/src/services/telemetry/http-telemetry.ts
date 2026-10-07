import { errorCodeSchema } from '@bemmoly/shared';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { UNMATCHED_ROUTE, type Metrics } from './metrics.ts';

export interface HttpTelemetryOptions {
  metrics: Metrics;
  /** The signed-in person's id for the summary line. The logger writes it hashed. */
  actorOf?: (request: FastifyRequest) => string | undefined;
}

/** Probes and scrapes run every few seconds; their summary lines are debug, not info. */
export const QUIET_ROUTES: ReadonlySet<string> = new Set(['/healthz', '/readyz', '/metrics']);

/** Status recorded when the client went away before a response was sent. */
export const CLIENT_CLOSED_REQUEST = 499;

const MAX_ERROR_BODY_BYTES = 64 * 1024;

interface RequestState {
  startedAt: bigint;
  finished: boolean;
  errorCode?: string;
}

/** Reads `code` from an error body; anything outside the shared enum counts as unknown. */
export function errorCodeOf(payload: unknown): string {
  if (typeof payload !== 'string' || payload.length > MAX_ERROR_BODY_BYTES) return 'unknown';
  let body: unknown;
  try {
    body = JSON.parse(payload);
  } catch {
    return 'unknown';
  }
  const code = (body as { code?: unknown } | null)?.code;
  return errorCodeSchema.safeParse(code).success ? (code as string) : 'unknown';
}

function routeOf(request: FastifyRequest): string {
  return request.routeOptions.url ?? UNMATCHED_ROUTE;
}

const plugin: FastifyPluginAsync<HttpTelemetryOptions> = async (app, options) => {
  const states = new WeakMap<FastifyRequest, RequestState>();

  const finish = (request: FastifyRequest, statusCode: number) => {
    const state = states.get(request);
    if (!state || state.finished) return;
    state.finished = true;
    const durationMs = Number(process.hrtime.bigint() - state.startedAt) / 1e6;
    const route = routeOf(request);
    options.metrics.http.requestFinished({
      method: request.method,
      route,
      statusCode,
      durationSeconds: durationMs / 1000,
      ...(state.errorCode ? { errorCode: state.errorCode } : {}),
    });
    const userId = options.actorOf?.(request);
    const line = {
      method: request.method,
      route,
      status: statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      ...(userId ? { userId } : {}),
      ...(state.errorCode ? { code: state.errorCode } : {}),
    };
    if (QUIET_ROUTES.has(route)) request.log.debug(line, 'request completed');
    else request.log.info(line, 'request completed');
  };

  app.addHook('onRequest', async (request) => {
    states.set(request, { startedAt: process.hrtime.bigint(), finished: false });
    options.metrics.http.requestStarted();
  });

  app.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: unknown) => {
    const state = states.get(request);
    if (state && reply.statusCode >= 400) state.errorCode = errorCodeOf(payload);
    return payload;
  });

  app.addHook('onResponse', async (request, reply) => finish(request, reply.statusCode));
  app.addHook('onRequestAbort', async (request) => finish(request, CLIENT_CLOSED_REQUEST));
};

/**
 * Request metrics and the one summary log line per request (method, route, status,
 * durationMs, requestId). Registered once on the root instance so it sees every route.
 */
export const httpTelemetry = fastifyPlugin(plugin, {
  name: 'bemmoly-http-telemetry',
  fastify: '5.x',
});
