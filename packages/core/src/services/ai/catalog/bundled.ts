import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import type { CatalogData } from '@bemmoly/shared';
import { trimCatalog } from './trim.ts';

/** The catalog and logos baked into the image by `pnpm ai:catalog` (scripts/ai-catalog.ts). */
const FOLDER = new URL('./bundled/', import.meta.url);

let catalog: Promise<CatalogData> | null = null;
let logos: Promise<Record<string, string>> | null = null;

async function gunzipJson(name: string): Promise<unknown> {
  return JSON.parse(gunzipSync(await readFile(new URL(name, FOLDER))).toString('utf8'));
}

export function bundledCatalog(): Promise<CatalogData> {
  catalog ??= gunzipJson('catalog.json.gz').then(trimCatalog);
  return catalog;
}

export function bundledLogos(): Promise<Record<string, string>> {
  logos ??= gunzipJson('logos.json.gz').then((value) => value as Record<string, string>);
  return logos;
}

export async function bundledMeta(): Promise<{ fetchedAt: string | null }> {
  try {
    const meta = JSON.parse(await readFile(new URL('meta.json', FOLDER), 'utf8')) as {
      fetchedAt?: string;
    };
    return { fetchedAt: meta.fetchedAt ?? null };
  } catch {
    return { fetchedAt: null };
  }
}

/**
 * A logo is third-party SVG served from our origin, so anything active in it is refused:
 * scripts, event handlers, foreign objects and javascript: links.
 */
export function safeSvg(svg: string | null | undefined): string | null {
  if (!svg || !svg.trimStart().startsWith('<svg')) return null;
  if (/<script|<foreignObject|\son[a-z]+\s*=|javascript:|<iframe|<!ENTITY/i.test(svg)) return null;
  return svg;
}
