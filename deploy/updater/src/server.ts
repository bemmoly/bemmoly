/**
 * The updater service: holds the Docker socket and does nothing except status(),
 * update(tag) and rollback() for the app, on the internal Compose network, with the
 * token the installer generated. It publishes no port.
 */
import { createServer } from 'node:http';
import { createDockerClient } from './clients/docker.ts';
import { loadUpdaterEnv } from './config/env.ts';
import { createUpdaterController } from './controllers/updater.controller.ts';
import { route } from './routes/updater.routes.ts';
import type { UpdaterContext } from './services/context.ts';
import { pruneImages } from './services/images.ts';
import { readState } from './services/state.ts';

const env = loadUpdaterEnv();
const ctx: UpdaterContext = {
  env,
  docker: createDockerClient(),
  now: () => new Date(),
  log(message, details) {
    process.stdout.write(
      `${JSON.stringify({ time: new Date().toISOString(), msg: message, ...details })}\n`,
    );
  },
};
const controller = createUpdaterController(ctx);

const server = createServer((request, response) => {
  route(controller, env.UPDATER_TOKEN, request)
    .then((reply) => {
      const body = reply.html ? String(reply.body) : JSON.stringify(reply.body);
      response.writeHead(reply.status, {
        'content-type': reply.html ? 'text/html; charset=utf-8' : 'application/json',
        'cache-control': 'no-store',
        ...(reply.html ? { 'retry-after': '5' } : {}),
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    })
    .catch((error: unknown) => {
      ctx.log('request failed', { error: String(error) });
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({ code: 'bad_request', message: 'The request could not be read' }),
      );
    });
});
server.requestTimeout = 30_000;
server.listen(env.UPDATER_PORT, '0.0.0.0', () =>
  ctx.log(`updater listening on ${env.UPDATER_PORT}`),
);

// Image retention also runs when no update happens for a while.
setInterval(() => {
  readState(env.BEMMOLY_DIR)
    .then((state) => pruneImages(ctx, state))
    .catch((error: unknown) => ctx.log('image retention failed', { error: String(error) }));
}, 6 * 3_600_000).unref();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
