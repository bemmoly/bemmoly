import { createHash, timingSafeEqual } from 'node:crypto';
import { NotFoundError, UnauthenticatedError } from '@bemmoly/shared';
import type { Metrics } from './metrics.ts';

export interface ScrapeDependencies {
  metrics: Metrics;
  /** BEMMOLY_METRICS_TOKEN. Unset: /metrics does not exist. */
  token?: string | undefined;
}

export interface ScrapeResult {
  body: string;
  contentType: string;
}

const BEARER = /^Bearer\s+(\S+)\s*$/i;

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Constant-time comparison; hashing first makes the lengths equal. */
export function tokensMatch(presented: string, expected: string): boolean {
  return timingSafeEqual(digest(presented), digest(expected));
}

/**
 * Prometheus scrape. Authenticated by the install's metrics token, not a session:
 * scrapers present `Authorization: Bearer <BEMMOLY_METRICS_TOKEN>`.
 */
export async function scrapeMetrics(
  deps: ScrapeDependencies,
  authorization: string | undefined,
): Promise<ScrapeResult> {
  if (!deps.token) throw new NotFoundError('No route for GET /metrics');
  const presented = BEARER.exec(authorization ?? '')?.[1];
  if (!presented || !tokensMatch(presented, deps.token)) {
    throw new UnauthenticatedError('A valid metrics token is required');
  }
  return { body: await deps.metrics.render(), contentType: deps.metrics.contentType };
}
