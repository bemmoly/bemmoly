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

async function fetchFacts(): Promise<RepoFacts | null> {
  try {
    const response = await fetch(API, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'bemmoly-site-build' },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { stargazers_count?: unknown };
    const stars = body.stargazers_count;
    return typeof stars === 'number' && Number.isInteger(stars) && stars >= 0 ? { stars } : null;
  } catch {
    return null;
  }
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
