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

/** Embedded pictures a logo may carry; nothing else is fetched or run. */
const IMAGE_DATA = String.raw`data:image/(?:png|jpe?g|gif|webp);base64,`;

/**
 * Anything active or anything that reaches out: scripts, event handlers, foreign objects,
 * links and animations that can rewrite them, character references that hide a scheme, and
 * every reference that is not to the logo itself or an embedded picture.
 */
const UNSAFE_SVG = new RegExp(
  [
    String.raw`<script|<foreignObject|<iframe|<!ENTITY|<a[\s>]|<animate|<set[\s>]`,
    String.raw`\son[a-z]+\s*=|javascript:|&#|@import`,
    String.raw`(?:xlink:)?href\s*=\s*["'](?!#|${IMAGE_DATA})`,
    String.raw`url\(\s*["']?(?!#)`,
    String.raw`data:(?!image/(?:png|jpe?g|gif|webp);base64,)`,
  ].join('|'),
  'i',
);

/** A logo is third-party SVG served from our origin, so anything active in it is refused. */
export function safeSvg(svg: string | null | undefined): string | null {
  if (!svg || !svg.trimStart().startsWith('<svg')) return null;
  if (UNSAFE_SVG.test(svg)) return null;
  return svg;
}
