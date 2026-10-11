import { describe, expect, it } from 'vitest';
import { buckets, isApiRoute, parseProm, windowCounts, windowQuantile } from './prom.ts';

const scrape = (fast: number, slow: number, errors: number) => `
# HELP bemmoly_http_request_duration_seconds HTTP request duration.
bemmoly_http_request_duration_seconds_bucket{le="0.04",method="GET",route="/api/v1/work/issues/:key",status_code="200"} ${fast}
bemmoly_http_request_duration_seconds_bucket{le="0.08",method="GET",route="/api/v1/work/issues/:key",status_code="200"} ${fast + slow}
bemmoly_http_request_duration_seconds_bucket{le="+Inf",method="GET",route="/api/v1/work/issues/:key",status_code="200"} ${fast + slow}
bemmoly_http_request_duration_seconds_count{method="GET",route="/api/v1/work/issues/:key",status_code="200"} ${fast + slow}
bemmoly_http_request_duration_seconds_count{method="GET",route="/api/v1/work/issues/:key",status_code="503"} ${errors}
bemmoly_http_request_duration_seconds_count{method="GET",route="/healthz",status_code="200"} 999
bemmoly_process_resident_memory_bytes 241786880
`;

describe('prometheus windows', () => {
  it('parses samples with labels', () => {
    const samples = parseProm(scrape(10, 0, 0));
    expect(samples.find((s) => s.name === 'bemmoly_process_resident_memory_bytes')?.value).toBe(
      241786880,
    );
    expect(samples[0]?.labels).toMatchObject({ le: '0.04', route: '/api/v1/work/issues/:key' });
  });

  it('takes p95 from the bucket deltas between two scrapes', () => {
    const before = buckets(parseProm(scrape(100, 0, 0)), isApiRoute);
    // 100 more requests: 90 under 40 ms, 10 between 40 and 80 ms.
    const after = buckets(parseProm(scrape(190, 10, 0)), isApiRoute);
    expect(windowQuantile(before, after, 0.5)).toBeCloseTo(22.2, 1);
    expect(windowQuantile(before, after, 0.95)).toBeCloseTo(60, 5);
    expect(windowQuantile(after, after, 0.95)).toBeNull();
  });

  it('counts requests and errors on API routes only', () => {
    const counts = windowCounts(parseProm(scrape(100, 0, 1)), parseProm(scrape(150, 0, 4)));
    expect(counts).toEqual({ requests: 53, clientErrors: 0, serverErrors: 3, rateLimited: 0 });
  });
});
