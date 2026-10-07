import { loadModules } from '@bemmoly/core';
import { loadEnv } from '@bemmoly/core/config';
import { buildApp } from './app.ts';
import { connectDatabase } from './config/database.ts';
import { closeOnSignals } from './config/lifecycle.ts';
import { importAvailableModules } from './config/modules.ts';
import { DEFAULT_WEB_ROOT } from './config/web.ts';

const env = loadEnv();
const modules = loadModules({
  available: await importAvailableModules(),
  enabled: env.BEMMOLY_MODULES,
});
const database = connectDatabase(env);
const app = await buildApp({
  env,
  modules,
  webRoot: DEFAULT_WEB_ROOT,
  ...(database ? { database: database.probe } : {}),
});
closeOnSignals(app, database);
await app.listen({ port: env.PORT, host: '0.0.0.0' });
