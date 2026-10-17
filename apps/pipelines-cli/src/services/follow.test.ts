import { describe, expect, it } from 'vitest';
import { main } from '../cli/main.ts';
import { testContext } from '../testing/context.ts';
import { fakeServer } from '../testing/fake-server.ts';

const SERVER = 'https://bemmoly.acme.test';
const JOB = '0190a1b2-0000-7000-8000-0000000000aa';
const line = (number: number, text: string) => ({
  number,
  text,
  spans: [],
  error: false,
  stepId: null,
});
const range = (lines: ReturnType<typeof line>[], totalLines: number, complete: boolean) => ({
  body: { jobId: JOB, lines, totalLines, complete, firstErrorLine: null },
});

describe('bp logs', () => {
  it('follows a job from where it left off until it is complete', async () => {
    const server = fakeServer({
      [`GET /api/v1/pipelines/runs/${JOB}`]: [
        { status: 404, body: { code: 'not_found', message: 'No such run' } },
      ],
      [`GET /api/v1/pipelines/jobs/${JOB}/logs`]: [
        range([line(1, '$ pnpm install'), line(2, 'Done')], 2, false),
        range([], 2, false),
        range([line(3, '$ pnpm test'), line(4, '12 passed')], 4, true),
      ],
    });
    const { ctx, output } = await testContext(server.fetch, {
      BEMMOLY_PIPELINES_URL: SERVER,
      BEMMOLY_PIPELINES_TOKEN: 'bmo_pat_token',
    });
    expect(await main(ctx, ['logs', JOB, '-f'])).toBe(0);
    expect(output.stdout).toEqual(['$ pnpm install', 'Done', '$ pnpm test', '12 passed']);
    const froms = server.requests
      .filter((request) => request.path.endsWith('/logs'))
      .map((request) => request.query.get('from'));
    expect(froms).toEqual(['1', '3', '3']);
  });
});
