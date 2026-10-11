/*
 * Reads the Prometheus text the install serves at /metrics and turns two scrapes into one
 * window: requests, 4xx and 5xx counts, and p95 from the latency histogram's bucket deltas,
 * interpolated inside the bucket the way histogram_quantile does.
 */

export interface Sample {
  name: string;
  labels: Record<string, string>;
  value: number;
}

const LINE = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(.*)\})?\s+(\S+)/;
const LABEL = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g;

export function parseProm(text: string): Sample[] {
  const samples: Sample[] = [];
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const match = LINE.exec(line);
    if (!match) continue;
    const labels: Record<string, string> = {};
    for (const [, key, value] of (match[2] ?? '').matchAll(LABEL))
      labels[key as string] = value as string;
    samples.push({ name: match[1] as string, labels, value: Number(match[3]) });
  }
  return samples;
}

export const sum = (
  samples: Sample[],
  name: string,
  where: (labels: Record<string, string>) => boolean = () => true,
) =>
  samples
    .filter((s) => s.name === name && where(s.labels))
    .reduce((total, s) => total + s.value, 0);

export const first = (
  samples: Sample[],
  name: string,
  where: (labels: Record<string, string>) => boolean = () => true,
) => samples.find((s) => s.name === name && where(s.labels))?.value;

const HISTOGRAM = 'bemmoly_http_request_duration_seconds';

/** API routes only: health checks and the scrape itself would flatter every number. */
export const isApiRoute = (labels: Record<string, string>) =>
  (labels['route'] ?? '').startsWith('/api/') || (labels['route'] ?? '').startsWith('/collab');

/** Cumulative bucket counts by upper bound, summed over the series `where` picks. */
export function buckets(
  samples: Sample[],
  where: (labels: Record<string, string>) => boolean,
): Map<number, number> {
  const out = new Map<number, number>();
  for (const s of samples) {
    if (s.name !== `${HISTOGRAM}_bucket` || !where(s.labels)) continue;
    const le = s.labels['le'] === '+Inf' ? Number.POSITIVE_INFINITY : Number(s.labels['le']);
    out.set(le, (out.get(le) ?? 0) + s.value);
  }
  return out;
}

/** The q-quantile in milliseconds of the requests between two scrapes; null when none. */
export function windowQuantile(
  before: Map<number, number>,
  after: Map<number, number>,
  q: number,
): number | null {
  const bounds = [...after.keys()].sort((a, b) => a - b);
  const deltas = bounds.map((le) => (after.get(le) ?? 0) - (before.get(le) ?? 0));
  const total = deltas.at(-1) ?? 0;
  if (total <= 0) return null;
  const rank = q * total;
  let lower = 0;
  let below = 0;
  for (const [i, le] of bounds.entries()) {
    const count = deltas[i] ?? 0;
    if (count >= rank) {
      if (!Number.isFinite(le)) return lower * 1000;
      const inBucket = count - below;
      const share = inBucket > 0 ? (rank - below) / inBucket : 0;
      return (lower + (le - lower) * share) * 1000;
    }
    lower = le;
    below = count;
  }
  return lower * 1000;
}

export interface WindowCounts {
  requests: number;
  clientErrors: number;
  serverErrors: number;
  rateLimited: number;
}

export function windowCounts(before: Sample[], after: Sample[]): WindowCounts {
  const count = (samples: Sample[], where: (labels: Record<string, string>) => boolean) =>
    sum(samples, `${HISTOGRAM}_count`, (labels) => isApiRoute(labels) && where(labels));
  const delta = (where: (labels: Record<string, string>) => boolean) =>
    count(after, where) - count(before, where);
  const status = (labels: Record<string, string>) => Number(labels['status_code'] ?? 0);
  return {
    requests: delta(() => true),
    clientErrors: delta((labels) => status(labels) >= 400 && status(labels) < 500),
    serverErrors: delta((labels) => status(labels) >= 500),
    rateLimited: delta((labels) => status(labels) === 429),
  };
}
