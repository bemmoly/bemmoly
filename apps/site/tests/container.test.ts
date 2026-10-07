/**
 * Checks the production image: Caddy's hosts, content types, cache and security headers.
 * Build the image, then run `pnpm --filter @bemmoly/site test:container`
 * (SITE_IMAGE defaults to bemmoly-site:dev).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { request } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const image = process.env.SITE_IMAGE ?? 'bemmoly-site:dev';
let container = '';
let base = '';

const get = (path: string, init: RequestInit = {}) =>
  fetch(`${base}${path}`, { redirect: 'manual', ...init });

/** fetch cannot set Host, so requests for a named host go through node:http. */
function asHost(
  host: string,
  path: string,
): Promise<{ status: number; headers: Headers; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(`${base}${path}`, { headers: { Host: host } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => (body += chunk));
      res.on('end', () => {
        const headers = new Headers();
        for (const [name, value] of Object.entries(res.headers)) {
          if (typeof value === 'string') headers.set(name, value);
        }
        resolve({ status: res.statusCode ?? 0, headers, body });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

beforeAll(async () => {
  container = execFileSync('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::80', image], {
    encoding: 'utf8',
  }).trim();
  const port = execFileSync('docker', ['port', container, '80/tcp'], { encoding: 'utf8' })
    .trim()
    .split(':')
    .pop();
  base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await fetch(base);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
});

afterAll(() => {
  if (container) execFileSync('docker', ['rm', '-f', container]);
});

describe('installer', () => {
  it('serves /install.sh as text/plain', async () => {
    const response = await get('/install.sh');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-cache');
  });

  it('serves the script at the root of get.bemmoly.com', async () => {
    const response = await asHost('get.bemmoly.com', '/');
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    const run = spawnSync('sh', { input: response.body, encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('The Bemmoly installer is not published yet');
  });

  it('sends other paths on get.bemmoly.com to the site', async () => {
    const response = await asHost('get.bemmoly.com', '/docs');
    expect(response.headers.get('location')).toBe('https://bemmoly.com/docs');
  });
});

describe('site', () => {
  it('redirects www to the apex', async () => {
    const response = await asHost('www.bemmoly.com', '/security');
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://bemmoly.com/security');
  });

  it.each(['/', '/self-hosting', '/security', '/changelog', '/docs', '/community'])(
    '%s is a page with a short cache',
    async (path) => {
      const response = await asHost('bemmoly.com', path);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
      expect(response.headers.get('cache-control')).toBe('public, max-age=300, must-revalidate');
    },
  );

  it('caches hashed assets for a year and compresses', async () => {
    const html = await (await get('/')).text();
    const asset = html.match(/\/_astro\/[^"]+\.woff2/)?.[0] ?? '';
    const response = await get(asset);
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    const page = await get('/', { headers: { 'Accept-Encoding': 'zstd, gzip' } });
    expect(page.headers.get('content-encoding')).toMatch(/zstd|gzip/);
  });

  it('answers unknown paths with the 404 page', async () => {
    const response = await get('/nowhere');
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('Page not found');
  });

  it('sends the security headers, and the CSP allows exactly the inline script', async () => {
    const response = await get('/');
    for (const header of [
      'strict-transport-security',
      'x-content-type-options',
      'referrer-policy',
    ]) {
      expect(response.headers.get(header), header).toBeTruthy();
    }
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('server')).toBeNull();
    const html = await response.text();
    const scripts = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
    const csp = response.headers.get('content-security-policy') ?? '';
    for (const [, body = ''] of scripts) {
      const hash = createHash('sha256').update(body).digest('base64');
      expect(csp).toContain(`'sha256-${hash}'`);
    }
  });
});
