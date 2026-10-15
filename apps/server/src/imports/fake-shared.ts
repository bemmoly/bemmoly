import { readFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';

/* The parts both fake sites share: their options, fixture loading and list paging. */

export type FakeSiteKind = 'jira-cloud' | 'jira-dc' | 'confluence';

export const FIXTURE_EMAIL = 'rohan@acmelabs.dev';
/** Not a credential anywhere: the fake site accepts only this string. */
export const FIXTURE_TOKEN = 'fixture-token-not-a-real-secret';

export interface FakeSiteOptions {
  kind: FakeSiteKind;
  /** Issues per search page; small by default so paging is exercised. */
  pageSize?: number;
  /** Replaces the fixture issues, for the performance run. */
  issues?: unknown[];
  /** Replaces the fixture projects (Jira), for a site with many of them. */
  projects?: { id: string; key: string; [field: string]: unknown }[];
  /** Issue totals of projects without issues in `issues`, by project key. */
  issueCounts?: Record<string, number>;
  /** Project ids the token can see but not browse (left out of action=browse). */
  unbrowsable?: Set<string>;
  /** Cloud leaves expand=insight out, as Jira may for an experimental expansion. */
  noInsight?: boolean;
  /** Answers 500 while it returns true. */
  failWhen?: (path: string, url: URL) => boolean;
  /** Paths answered once with 429 and Retry-After: 0. */
  rateLimitOnce?: Set<string>;
  /** Answers 429 with Retry-After: 0 every time it returns true: a source that never relents. */
  rateLimitWhen?: (path: string, url: URL) => boolean;
}

export type Lists = Record<string, unknown[]>;

/** What a site handler answers: status, body and extra headers. */
export type Answer = [number, unknown, Record<string, string>?];

export const load = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(`./fixtures/${path}`, import.meta.url), 'utf8')) as T;

export function page<T>(items: T[], url: URL, size = 50) {
  const start = Number(url.searchParams.get('startAt') ?? url.searchParams.get('start') ?? 0);
  const limit = Math.min(
    size,
    Number(url.searchParams.get('maxResults') ?? url.searchParams.get('limit') ?? size),
  );
  const values = items.slice(start, start + limit);
  return { start, values, isLast: start + values.length >= items.length };
}

export async function bodyOf(req: IncomingMessage): Promise<{ jql?: string } | null> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return chunks.length
    ? (JSON.parse(Buffer.concat(chunks).toString('utf8')) as { jql?: string })
    : null;
}
