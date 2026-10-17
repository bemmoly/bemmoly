/* eslint-disable no-restricted-properties -- a container's own program, not the server:
   its environment, set by the local provider, is its whole configuration. */
// Answers with the version it was deployed as (the local provider sets VERSION and
// REVISION) and fails a share of requests when ERROR_RATE says so, which is how a bad
// release shows itself in the demo. /healthz is what the splitter probes before traffic.
import http from 'node:http';

const version = process.env.VERSION || 'unknown';
const revision = process.env.REVISION || 'unknown';
const application = process.env.APPLICATION || 'app';
const errorRate = Number(process.env.ERROR_RATE || 0);
const latency = Number(process.env.LATENCY_MS || 40);

http
  .createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200);
      res.end('ok\n');
      return;
    }
    setTimeout(
      () => {
        if (Math.random() < errorRate) {
          res.writeHead(500, { 'content-type': 'text/plain' });
          res.end(`${version} failed this request\n`);
          return;
        }
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end(`${application} ${version} (revision ${revision}, built image)\n`);
      },
      latency * (0.5 + Math.random()),
    );
  })
  .listen(Number(process.env.PORT || 8080));
