import { describe, expect, it } from 'vitest';
import { createRecordingTransport } from './gcp-record.ts';
import { createReplayTransport } from './gcp-replay.ts';

/* A capture from a sandbox replays as it was recorded, and keeps no token. */

describe('recording Google Cloud answers', () => {
  it('keeps each exchange, redacts tokens and replays the result', async () => {
    const recorder = createRecordingTransport(async (url) =>
      url.includes('generateAccessToken')
        ? new Response(JSON.stringify({ accessToken: 'ya29.secret', expireTime: 'x' }))
        : new Response('{"name":"projects/1"}', { status: 404 }),
    );
    const signal = new AbortController().signal;
    const init = { method: 'POST', headers: {}, body: 'access_token=ya29.secret', signal };
    await recorder.transport(
      'https://iamcredentials.googleapis.com/v1/x:generateAccessToken',
      init,
    );
    await recorder.transport('https://cloudresourcemanager.googleapis.com/v3/projects/p', {
      method: 'GET',
      headers: {},
      signal,
    });
    const file = recorder.take('test');
    expect(JSON.stringify(file)).not.toContain('ya29.secret');
    expect(file.exchanges[0]).toMatchObject({
      body: { access_token: 'redacted' },
      response: { accessToken: 'redacted' },
    });
    expect(file.exchanges[1]).toMatchObject({ method: 'GET', status: 404 });
    const replay = createReplayTransport(file.exchanges);
    const answer = await replay.transport(
      'https://cloudresourcemanager.googleapis.com/v3/projects/p',
      { method: 'GET', headers: {}, signal },
    );
    expect(answer.status).toBe(404);
  });
});
