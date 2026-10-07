import { loadEnv } from '@bemmoly/core/config';
import { bootApplication } from './config/boot.ts';
import { closeOnSignals } from './config/lifecycle.ts';
import { importAvailableModules } from './config/modules.ts';
import { DEFAULT_WEB_ROOT } from './config/web.ts';

const env = loadEnv();
const { app, database, kernel } = await bootApplication({
  env,
  available: await importAvailableModules(),
  webRoot: DEFAULT_WEB_ROOT,
});
closeOnSignals(app, database, kernel);
await kernel?.start();
await app.listen({ port: env.PORT, host: '0.0.0.0' });
