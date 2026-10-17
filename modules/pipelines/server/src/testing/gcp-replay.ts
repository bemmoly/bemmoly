import { readFileSync } from 'node:fs';
import type { GcpTransport } from '../clients/gcp/index.ts';
import type { DeployTarget } from '../services/providers/contract.ts';

/*
 * Replays recorded Google Cloud answers so no test reaches the network. An exchange matches
 * on method, path, the query parameters it lists and, when it has one, a subset of the JSON
 * body. Exchanges are used once, in order, unless marked `repeat`. A request nothing matches
 * is recorded and answered with an error, and `verify()` fails the test for it, so code that
 * catches errors cannot hide an unexpected call.
 */

export interface RecordedExchange {
  method: string;
  /** Absolute URL; any query parameters given must be present with the same value. */
  url: string;
  body?: unknown;
  status?: number;
  response?: unknown;
  /** Matches any number of times, for token and lookup calls. */
  repeat?: boolean;
}

export interface FixtureFile {
  recorded: string;
  exchanges: RecordedExchange[];
}

export interface ReplayTransport {
  transport: GcpTransport;
  /** Requests that matched nothing, as "METHOD url". */
  unmatched: string[];
  /** Every request in order, as "METHOD path". */
  calls: string[];
  /** Throws when a request went unmatched or an exchange that must be used was not. */
  verify(options?: { allUsed?: boolean }): void;
}

const FIXTURES = new URL('../clients/gcp/fixtures/', import.meta.url);

export function loadFixture(name: string): RecordedExchange[] {
  const file = JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES), 'utf8')) as FixtureFile;
  return file.exchanges;
}

/** Whether `actual` contains everything `expected` has; arrays must match item by item. */
export function containsSubset(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((item, index) => containsSubset(actual[index], item))
    );
  }
  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object') return false;
    return Object.entries(expected).every(([key, value]) =>
      containsSubset((actual as Record<string, unknown>)[key], value),
    );
  }
  return actual === expected;
}

function matches(exchange: RecordedExchange, method: string, url: URL, body: unknown): boolean {
  if (exchange.method !== method) return false;
  const wanted = new URL(exchange.url);
  if (wanted.origin !== url.origin || wanted.pathname !== url.pathname) return false;
  for (const [key, value] of wanted.searchParams) {
    if (url.searchParams.get(key) !== value) return false;
  }
  return exchange.body === undefined || containsSubset(body, exchange.body);
}

const parseBody = (body: string | undefined): unknown => {
  if (body === undefined) return undefined;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return Object.fromEntries(new URLSearchParams(body));
  }
};

export function createReplayTransport(...sets: RecordedExchange[][]): ReplayTransport {
  const exchanges = sets.flat().map((exchange) => ({ exchange, used: false }));
  const unmatched: string[] = [];
  const calls: string[] = [];
  const transport: GcpTransport = async (raw, init) => {
    const url = new URL(raw);
    const body = parseBody(init.body);
    calls.push(`${init.method} ${decodeURIComponent(url.pathname)}`);
    const found = exchanges.find(
      (entry) =>
        (!entry.used || entry.exchange.repeat) && matches(entry.exchange, init.method, url, body),
    );
    if (!found) {
      unmatched.push(`${init.method} ${raw}${init.body ? ` ${init.body}` : ''}`);
      return new Response(
        JSON.stringify({ error: { message: `Unrecorded ${init.method} ${raw}` } }),
        {
          status: 599,
        },
      );
    }
    found.used = true;
    const status = found.exchange.status ?? 200;
    const text =
      found.exchange.response === undefined ? '' : JSON.stringify(found.exchange.response);
    return new Response(status === 204 ? null : text, { status });
  };
  return {
    transport,
    unmatched,
    calls,
    verify(options = {}) {
      if (unmatched.length > 0) {
        throw new Error(`Requests with no recorded answer:\n${unmatched.join('\n')}`);
      }
      const unused = exchanges.filter((entry) => !entry.used && !entry.exchange.repeat);
      if (options.allUsed && unused.length > 0) {
        throw new Error(
          `Recorded answers never asked for:\n${unused.map((entry) => `${entry.exchange.method} ${entry.exchange.url}`).join('\n')}`,
        );
      }
    },
  };
}

/** A token source that never touches the network. */
export const fixedTokens = (token = 'ya29.recorded-token') => ({ token: async () => token });

/** Checkout in Commerce · Prod, the target every recorded Cloud Run answer is about. */
export const GCP_PROD_TARGET: DeployTarget = {
  connection: {
    id: '0199f0aa-0000-7000-8000-000000000001',
    provider: 'gcp',
    name: 'Acme Google Cloud',
    layout: 'per-domain-environment',
    boundaryRef: 'folders/417302018845',
    config: { organizationId: '583920174411', billingAccountId: '01A2B3-C4D5E6-F7A8B9' },
  },
  environment: { id: 'e', key: 'prod-asia-south1', class: 'prod', region: 'asia-south1' },
  account: { externalId: 'acme-commerce-prod', name: 'Commerce · Prod' },
  application: { id: 'a', key: 'checkout-api', runtime: 'container-service' },
};
