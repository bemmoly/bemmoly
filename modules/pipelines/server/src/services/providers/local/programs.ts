/*
 * The two tiny programs the local provider runs in stock Node containers, so a laptop needs
 * no image built for the demo.
 *
 * The traffic splitter sits in front of an application in one environment: it sends each
 * request to a revision by weight, counts requests, 5xx answers and latency per revision in
 * five-second buckets, and serves those counts to the control plane on an admin port, which
 * asks for a token: every revision on the network could reach it, and set another
 * application's routes. That
 * is where canary metrics come from, so a canary is judged on real requests. A small load
 * generator calls it a few times a second so there is traffic to judge on an idle laptop.
 *
 * The demo application answers with its version and fails a share of requests when its
 * release says so (demo.errorRate), which is how a bad release shows itself in the demo.
 */

export const SPLITTER_PROGRAM = String.raw`
const http = require('http');
let routes = [];
const buckets = new Map();
const BUCKET = 5000, KEEP = 30 * 60 * 1000;
function record(revision, failed, ms) {
  const t = Math.floor(Date.now() / BUCKET) * BUCKET;
  let list = buckets.get(revision);
  if (!list) { list = []; buckets.set(revision, list); }
  let b = list[list.length - 1];
  if (!b || b.t !== t) { b = { t: t, n: 0, e: 0, lat: [] }; list.push(b); }
  b.n += 1; if (failed) b.e += 1; if (b.lat.length < 400) b.lat.push(ms);
  while (list.length && list[0].t < Date.now() - KEEP) list.shift();
}
function pick() {
  const r = Math.random() * 100; let acc = 0;
  for (const route of routes) { acc += route.percent; if (r < acc) return route; }
  return routes.find(function (x) { return x.percent > 0; });
}
http.createServer(function (req, res) {
  const route = pick();
  if (!route) { res.writeHead(503, { 'content-type': 'text/plain' }); res.end('No revision takes traffic yet\n'); return; }
  const started = Date.now();
  const url = new URL(route.upstream);
  const upstream = http.request({ host: url.hostname, port: url.port, path: req.url, method: req.method, headers: req.headers, timeout: 10000 }, function (up) {
    record(route.revision, (up.statusCode || 500) >= 500, Date.now() - started);
    const headers = Object.assign({}, up.headers, { 'x-bemmoly-revision': route.revision });
    res.writeHead(up.statusCode || 502, headers); up.pipe(res);
  });
  upstream.on('timeout', function () { upstream.destroy(new Error('timeout')); });
  upstream.on('error', function () {
    record(route.revision, true, Date.now() - started);
    if (!res.headersSent) { res.writeHead(502, { 'content-type': 'text/plain' }); }
    res.end('Bad gateway\n');
  });
  req.pipe(upstream);
}).listen(8080);
function p95(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort(function (a, b) { return a - b; });
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}
function answer(res, status, body) { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); }
const crypto = require('crypto');
const ADMIN = Buffer.from('Bearer ' + (process.env.ADMIN_TOKEN || ''));
function allowed(req) {
  if (!process.env.ADMIN_TOKEN) return true;
  const sent = Buffer.from(String(req.headers['authorization'] || ''));
  return sent.length === ADMIN.length && crypto.timingSafeEqual(sent, ADMIN);
}
http.createServer(function (req, res) {
  if (!allowed(req)) return answer(res, 401, { error: 'Send the admin token' });
  const url = new URL(req.url, 'http://admin');
  if (url.pathname === '/routes' && req.method === 'GET') return answer(res, 200, { routes: routes });
  if (url.pathname === '/routes' && req.method === 'PUT') {
    let text = '';
    req.on('data', function (c) { text += c; });
    req.on('end', function () {
      try { routes = JSON.parse(text).routes || []; answer(res, 200, { routes: routes }); }
      catch (e) { answer(res, 400, { error: 'Send {"routes": [...]}' }); }
    });
    return;
  }
  if (url.pathname === '/metrics') {
    const from = Number(url.searchParams.get('from') || 0), to = Number(url.searchParams.get('to') || Date.now());
    const revision = url.searchParams.get('revision');
    const lists = revision ? [buckets.get(revision) || []] : Array.from(buckets.values());
    let n = 0, e = 0, lat = []; const series = new Map();
    for (const list of lists) for (const b of list) {
      if (b.t + BUCKET <= from || b.t > to) continue;
      n += b.n; e += b.e; lat = lat.concat(b.lat);
      const s = series.get(b.t) || { n: 0, e: 0, lat: [] }; s.n += b.n; s.e += b.e; s.lat = s.lat.concat(b.lat); series.set(b.t, s);
    }
    return answer(res, 200, {
      requests: n, errors: e, errorRate: n ? e / n : null, p95: p95(lat),
      series: Array.from(series.entries()).sort(function (a, b) { return a[0] - b[0]; })
        .map(function (x) { return [x[0], x[1].n ? x[1].e / x[1].n : 0, p95(x[1].lat)]; }),
    });
  }
  if (url.pathname === '/probe') {
    const target = new URL(url.searchParams.get('upstream') || 'http://invalid');
    const probe = http.get({ host: target.hostname, port: target.port, path: '/healthz', timeout: 2000 }, function (up) {
      up.resume(); answer(res, up.statusCode === 200 ? 200 : 503, { status: up.statusCode });
    });
    probe.on('timeout', function () { probe.destroy(new Error('timeout')); });
    probe.on('error', function (err) { answer(res, 503, { error: err.message }); });
    return;
  }
  answer(res, 404, { error: 'Not here' });
}).listen(8081);
const rps = Number(process.env.LOAD_RPS || 0);
if (rps > 0) setInterval(function () {
  http.get({ host: '127.0.0.1', port: 8080, path: '/', timeout: 5000 }, function (r) { r.resume(); }).on('error', function () {});
}, Math.max(20, Math.floor(1000 / rps)));
`;

export const DEMO_APP_PROGRAM = String.raw`
const http = require('http');
const version = process.env.VERSION || 'unknown';
const revision = process.env.REVISION || 'unknown';
const errorRate = Number(process.env.ERROR_RATE || 0);
const latency = Number(process.env.LATENCY_MS || 40);
http.createServer(function (req, res) {
  if (req.url === '/healthz') { res.writeHead(200); res.end('ok\n'); return; }
  setTimeout(function () {
    if (Math.random() < errorRate) { res.writeHead(500, { 'content-type': 'text/plain' }); res.end(version + ' failed this request\n'); return; }
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end((process.env.APPLICATION || 'app') + ' ' + version + ' (revision ' + revision + ')\n');
  }, latency * (0.5 + Math.random()));
}).listen(Number(process.env.PORT || 8080));
`;
