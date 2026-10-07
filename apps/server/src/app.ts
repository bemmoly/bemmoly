import type { DatabaseProbe, ModuleRegistry } from '@bemmoly/core';
import { kernelRoutes } from '@bemmoly/core';
import { createLoggerOptions, type Env } from '@bemmoly/core/config';
import { getMetrics, httpTelemetry, type Metrics } from '@bemmoly/core/telemetry';
import Fastify, { type FastifyInstance } from 'fastify';
import { apiNotFoundHandler, errorHandler } from './middlewares/error-handler.ts';
import { exposeRequestId, requestIdOptions } from './middlewares/request-id.ts';
import { hasWebBuild, registerWebApp } from './middlewares/static-web.ts';

export interface BuildAppOptions {
  /** The secret key, when present, keys the hash the logger writes for user ids. */
  env: Pick<Env, 'BEMMOLY_TRUST_PROXY' | 'LOG_LEVEL' | 'LOG_FORMAT' | 'BEMMOLY_METRICS_TOKEN'> &
    Partial<Pick<Env, 'BEMMOLY_SECRET_KEY'>>;
  modules: ModuleRegistry;
  database?: DatabaseProbe;
  /** Absolute path of the web build; skipped when it has no index.html. */
  webRoot?: string;
  /** Defaults to the process-wide metrics; tests pass their own. */
  metrics?: Metrics;
  /** false silences logs; a stream captures them, for tests. */
  logger?: false | { stream: NodeJS.WritableStream };
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : { ...createLoggerOptions(options.env), ...(options.logger ?? {}) },
    trustProxy: options.env.BEMMOLY_TRUST_PROXY,
    ...requestIdOptions(),
  });
  const metrics = options.metrics ?? getMetrics();
  app.addHook('onRequest', exposeRequestId);
  app.setErrorHandler(errorHandler);
  await app.register(httpTelemetry, { metrics });
  await app.register(
    kernelRoutes({
      modules: options.modules,
      metrics: { metrics, token: options.env.BEMMOLY_METRICS_TOKEN },
      ...(options.database ? { database: options.database } : {}),
    }),
  );
  if (options.webRoot && hasWebBuild(options.webRoot)) {
    await registerWebApp(app, options.webRoot);
  } else {
    app.setNotFoundHandler(apiNotFoundHandler);
  }
  return app;
}
