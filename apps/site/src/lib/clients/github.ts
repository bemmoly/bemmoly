/**
 * Live facts about the repository, fetched once per build with a short timeout. A failure of
 * any kind (offline CI, rate limit, a changed API) returns null, and the pages then leave the
 * number out rather than show a stale or invented one.
 */
import { REPO_URL } from '../links.ts';

const TIMEOUT_MS = 5_000;
const API = REPO_URL.replace('https://github.com/', 'https://api.github.com/repos/');

export interface RepoFacts {
  stars: number;
}

async function getJson(url: string): Promise<unknown> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'bemmoly-site-build' },
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

async function fetchFacts(): Promise<RepoFacts | null> {
  const body = (await getJson(API)) as { stargazers_count?: unknown } | null;
  const stars = body?.stargazers_count;
  return typeof stars === 'number' && Number.isInteger(stars) && stars >= 0 ? { stars } : null;
}

/**
 * The version of the newest published GitHub release ("v0.12.0" to "0.12.0"), or null. The
 * release workflow's publish job is the only thing that creates one, after the images, notes
 * and manifest are out, so a version that is tagged but not yet published never counts.
 * Pre-releases and drafts are never "latest" on GitHub, so the beta channel never counts either.
 */
export async function fetchPublishedVersion(): Promise<string | null> {
  const body = (await getJson(`${API}/releases/latest`)) as { tag_name?: unknown } | null;
  const tag = body?.tag_name;
  const match = typeof tag === 'string' ? /^v?(\d+\.\d+\.\d+)$/.exec(tag) : null;
  return match?.[1] ?? null;
}

let facts: Promise<RepoFacts | null> | undefined;

/** The repository's facts, asked for once however many pages and components want them. */
export function repoFacts(): Promise<RepoFacts | null> {
  facts ??= fetchFacts();
  return facts;
}

/** 950 → "950", 1234 → "1.2k", 12345 → "12k": the count as a chip shows it. */
export function formatCount(count: number): string {
  if (count < 1000) return String(count);
  const thousands = count / 1000;
  return `${thousands < 10 ? thousands.toFixed(1).replace(/\.0$/, '') : Math.round(thousands)}k`;
}
