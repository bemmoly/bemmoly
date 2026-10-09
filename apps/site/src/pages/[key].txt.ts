import type { APIRoute } from 'astro';
import { INDEXNOW_KEY } from '../lib/indexnow.ts';

/** The IndexNow ownership proof: the key, served as the body of /<key>.txt. */
export function getStaticPaths() {
  return [{ params: { key: INDEXNOW_KEY } }];
}

export const GET: APIRoute = () =>
  new Response(INDEXNOW_KEY, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
