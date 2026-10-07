import { describe, expect, it } from 'vitest';
import { ApiRequestError, fetchModules } from './modules.ts';

const respond = (status: number, body: unknown): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

describe('fetchModules', () => {
  it('returns validated manifests', async () => {
    const items = [
      {
        id: 'sample',
        version: '0.0.0',
        navigation: [{ id: 'sample', label: 'Sample', path: '/sample', placement: 'top' }],
      },
    ];
    await expect(fetchModules(respond(200, { items }))).resolves.toEqual(items);
  });

  it('raises the API error code and request id', async () => {
    const failing = respond(403, { code: 'forbidden', message: 'No', requestId: 'req-42' });
    await expect(fetchModules(failing)).rejects.toMatchObject({
      name: 'ApiRequestError',
      status: 403,
      code: 'forbidden',
      requestId: 'req-42',
    });
  });

  it('rejects a response that does not match the shared schema', async () => {
    await expect(fetchModules(respond(200, { items: [{ id: 'X' }] }))).rejects.not.toBeInstanceOf(
      ApiRequestError,
    );
  });
});
