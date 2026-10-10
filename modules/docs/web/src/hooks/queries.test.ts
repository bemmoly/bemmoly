import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { id, space, startServer } from '../test-support.tsx';
import { listEverySpace } from './queries.ts';

const asked: (string | null)[] = [];
const first = space();
const newest = space({ id: id(9500), key: 'NEW', name: 'Newest' });

startServer(
  http.get('*/api/v1/docs/spaces', ({ request }) => {
    const cursor = new URL(request.url).searchParams.get('cursor');
    asked.push(cursor);
    return cursor === 'next'
      ? HttpResponse.json({ items: [newest], nextCursor: null })
      : HttpResponse.json({ items: [first], nextCursor: 'next' });
  }),
);

describe('listEverySpace', () => {
  it('follows the cursor to the last page, so the newest spaces are there too', async () => {
    const spaces = await listEverySpace();
    expect(spaces.map((item) => item.key)).toEqual([first.key, 'NEW']);
    expect(asked).toEqual([null, 'next']);
  });
});
