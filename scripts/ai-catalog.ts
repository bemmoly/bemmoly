/**
 * `pnpm ai:catalog`: refresh the models.dev catalog and provider logos bundled in the image.
 * The AI runtime uses this copy only when the live catalog and every stored snapshot are
 * unavailable (ADR 0006). Run it before each release; the release workflow does.
 *
 * Writes packages/core/src/services/ai/catalog/bundled/:
 *   catalog.json.gz  the trimmed api.json (providers and the model fields Bemmoly reads)
 *   logos.json.gz    { "<provider id>": "<svg>" } for every provider with a logo
 *   meta.json        when and from where it was fetched, with counts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { countCatalogModels, trimCatalog } from '../packages/core/src/services/ai/index.ts';

const SOURCE = 'https://models.dev';
const out = fileURLToPath(
  new URL('../packages/core/src/services/ai/catalog/bundled/', import.meta.url),
);

function log(message: string): void {
  console.log(`[ai:catalog] ${message}`);
}

async function fetchText(url: string, timeoutMs: number): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
}

async function main(): Promise<void> {
  const response = await fetchText(`${SOURCE}/api.json`, 30_000);
  if (!response.ok) throw new Error(`${SOURCE}/api.json answered ${response.status}`);
  const etag = response.headers.get('etag');
  const catalog = trimCatalog(await response.json());
  const ids = Object.keys(catalog).sort();
  log(`${ids.length} providers, ${countCatalogModels(catalog)} models`);

  const logos: Record<string, string> = {};
  const queue = [...ids];
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      try {
        const logo = await fetchText(`${SOURCE}/logos/${id}.svg`, 10_000);
        const type = logo.headers.get('content-type') ?? '';
        const svg = logo.ok && type.includes('svg') ? await logo.text() : '';
        if (svg.startsWith('<svg') && svg.length < 256 * 1024) logos[id] = svg;
      } catch {
        log(`no logo for ${id}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  log(`${Object.keys(logos).length} logos`);

  mkdirSync(out, { recursive: true });
  const sorted = Object.fromEntries(ids.map((id) => [id, catalog[id]]));
  writeFileSync(`${out}catalog.json.gz`, gzipSync(JSON.stringify(sorted), { level: 9 }));
  const sortedLogos = Object.fromEntries(
    Object.keys(logos)
      .sort()
      .map((id) => [id, logos[id]]),
  );
  writeFileSync(`${out}logos.json.gz`, gzipSync(JSON.stringify(sortedLogos), { level: 9 }));
  const meta = {
    source: SOURCE,
    fetchedAt: new Date().toISOString(),
    etag,
    providers: ids.length,
    models: countCatalogModels(catalog),
    logos: Object.keys(logos).length,
  };
  writeFileSync(`${out}meta.json`, `${JSON.stringify(meta, null, 2)}\n`);
  log(`wrote ${out}`);
}

await main();
