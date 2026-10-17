import type {
  AuthorizationCache,
  DatabaseProbe,
  IdentityDependencies,
  KernelRouteDependencies,
  MaintenanceState,
  ModuleRegistry,
  RateLimitEnv,
  SqlClient,
} from '@bemmoly/core';
import {
  authentication,
  csrfProtection,
  kernelRoutes,
  maintenanceHook,
  rateLimitBudgets,
  rateLimiting,
  requestUserId,
  securityHeaders,
} from '@bemmoly/core';
import { createLoggerOptions, type Env } from '@bemmoly/core/config';
import { getMetrics, httpTelemetry, type Metrics } from '@bemmoly/core/telemetry';
import Fastify, { type FastifyInstance } from 'fastify';
import { apiNotFoundHandler, errorHandler } from './middlewares/error-handler.ts';
import { exposeRequestId, requestIdOptions } from './middlewares/request-id.ts';
import { hasWebBuild, registerWebApp, type ProductWeb } from './middlewares/static-web.ts';

export interface BuildAppOptions {
  /** The secret key, when present, keys the hash the logger writes for user ids. */
  env: Pick<
    Env,
    | 'BEMMOLY_TRUST_PROXY'
    | 'LOG_LEVEL'
    | 'LOG_FORMAT'
    | 'BEMMOLY_PUBLIC_URL'
    | 'BEMMOLY_METRICS_TOKEN'
  > &
    Partial<Pick<Env, 'BEMMOLY_SECRET_KEY'>> &
    RateLimitEnv;
  modules: ModuleRegistry;
  database?: DatabaseProbe;
  /** Data kernel services (module state, settings, realtime, identity hooks); see config/kernel.ts. */
  kernel?: Omit<KernelRouteDependencies, 'modules' | 'database' | 'identity'>;
  /** Sign-in, people, roles and audit; present when a database is configured. */
  identity?: IdentityDependencies & { sql: SqlClient };
  /** Shares authorization lookups across requests; only with the bemmoly_authz listener on. */
  authzCache?: AuthorizationCache;
  /** Reads <data>/maintenance.json; while set, writes get 503 and pages the maintenance page. */
  maintenance?: () => Promise<MaintenanceState | null>;
  /** Absolute path of the web build; skipped when it has no index.html. */
  webRoot?: string;
  /** Products' own web apps under their base path; each is skipped without a build. */
  productWebs?: readonly ProductWeb[];
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
  if (options.maintenance) app.addHook('onRequest', maintenanceHook(options.maintenance));
  app.setErrorHandler(errorHandler);
  await app.register(httpTelemetry, { metrics, actorOf: requestUserId });
  const { BEMMOLY_PUBLIC_URL: publicUrl } = options.env;
  await app.register(securityHeaders, { publicUrl });
  await app.register(csrfProtection, { publicUrl });
  if (options.identity) {
    // Rate limiting first, so its checks run before any credential is looked up.
    await app.register(rateLimiting, {
      sql: options.identity.sql,
      ...rateLimitBudgets(options.env),
    });
    await app.register(authentication, {
      ...options.identity,
      ...(options.authzCache ? { authzCache: options.authzCache } : {}),
    });
  }
  await app.register(
    kernelRoutes({
      ...options.kernel,
      modules: options.modules,
      metrics: { metrics, token: options.env.BEMMOLY_METRICS_TOKEN },
      ...(options.database ? { database: options.database } : {}),
      ...(options.identity ? { identity: options.identity } : {}),
    }),
  );
  if (options.webRoot && hasWebBuild(options.webRoot)) {
    await registerWebApp(app, options.webRoot, options.productWebs);
  } else {
    app.setNotFoundHandler(apiNotFoundHandler);
  }
  return app;
}
