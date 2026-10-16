import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { topicOf } from '../../../../shared/streams.ts';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';
import { publishStreamEvent } from './index.ts';

/** Reads server-sent events off a live socket until `count` data lines arrive. */
async function readEvents(response: Response, count: number, timeoutMs = 5000) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('no body');
  const decoder = new TextDecoder();
  const events: unknown[] = [];
  let buffer = '';
  const deadline = Date.now() + timeoutMs;
  while (events.length < count && Date.now() < deadline) {
    const chunk = await Promise.race([
      reader.read(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), deadline - Date.now())),
    ]);
    if (!chunk || chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    for (const line of buffer.split('\n')) {
      if (line.startsWith('data: ')) events.push(JSON.parse(line.slice(6)));
    }
    buffer = buffer.slice(buffer.lastIndexOf('\n') + 1);
  }
  await reader.cancel();
  return events;
}

describe('live streams over LISTEN/NOTIFY', () => {
  let harness: PipelinesHarness | undefined;
  let http: PipelinesHttp;
  let base = '';
  let reason = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    await seedCatalogFixture(harness.sql, harness.users.member);
    http = await startPipelinesHttp(harness);
    await http.app.listen({ port: 0, host: '127.0.0.1' });
    base = `http://127.0.0.1:${(http.app.server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await harness?.services.streams.hub.stop();
    await http?.app.close();
    await harness?.stop();
  });

  const open = (topics: string, as: string) =>
    fetch(`${base}/api/v1/pipelines/streams?topics=${encodeURIComponent(topics)}`, {
      headers: { 'x-test-user': as },
    });

  it('starts with the live counter, then delivers a committed NOTIFY', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const response = await open('live,map:', harness.users.member);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reading = readEvents(response, 2);
    // Give the LISTEN a moment to be registered before the writer notifies.
    await new Promise((resolve) => setTimeout(resolve, 300));
    await harness.sql.begin(async (tx) => {
      await publishStreamEvent(tx, {
        topic: topicOf.map(''),
        kind: 'map.cell',
        data: { cells: [{ row: 'commerce', column: 'dev' }] },
      });
    });
    const events = await reading;
    expect(events).toEqual([
      expect.objectContaining({ topic: 'live', kind: 'counter', data: { running: 1, queued: 2 } }),
      expect.objectContaining({ topic: 'map:', kind: 'map.cell' }),
    ]);
  });

  it('refuses a stream to someone Pipelines is not granted to, and unknown topics', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    expect((await open('live', harness.users.outsider)).status).toBe(403);
    expect((await open('nope', harness.users.member)).status).toBe(400);
  });
});
