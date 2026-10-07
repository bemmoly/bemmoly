import type { DatabaseProbe, IdentityDependencies, ModuleRegistry, SqlClient } from '@bemmoly/core';
import {
  authentication,
  csrfProtection,
  kernelRoutes,
  rateLimiting,
  securityHeaders,
} from '@bemmoly/core';
import { createLoggerOptions, type Env } from '@bemmoly/core/config';
import Fastify, { type FastifyInstance } from 'fastify';
import { apiNotFoundHandler, errorHandler } from './middlewares/error-handler.ts';
import { exposeRequestId, requestIdOptions } from './middlewares/request-id.ts';
import { hasWebBuild, registerWebApp } from './middlewares/static-web.ts';

export interface BuildAppOptions {
  env: Pick<Env, 'BEMMOLY_TRUST_PROXY' | 'LOG_LEVEL' | 'LOG_FORMAT' | 'BEMMOLY_PUBLIC_URL'>;
  modules: ModuleRegistry;
  database?: DatabaseProbe;
  /** Sign-in, people, roles and audit; present when a database is configured. */
  identity?: IdentityDependencies & { sql: SqlClient };
  /** Absolute path of the web build; skipped when it has no index.html. */
  webRoot?: string;
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
  app.addHook('onRequest', exposeRequestId);
  app.setErrorHandler(errorHandler);
  const { BEMMOLY_PUBLIC_URL: publicUrl } = options.env;
  await app.register(securityHeaders, { publicUrl });
  await app.register(csrfProtection, { publicUrl });
  if (options.identity) await app.register(authentication, options.identity);
  if (options.identity) await app.register(rateLimiting, { sql: options.identity.sql });
  await app.register(
    kernelRoutes({
      modules: options.modules,
      ...(options.database ? { database: options.database } : {}),
      ...(options.identity ? { identity: options.identity } : {}),
    }),
  );
  if (options.webRoot && hasWebBuild(options.webRoot)) {
    await registerWebApp(app, options.webRoot);
  } else {
    app.setNotFoundHandler(apiNotFoundHandler);
  }
  return app;
}
