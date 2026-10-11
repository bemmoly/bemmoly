import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { id, project, startServer } from '../issue/test-support.tsx';
import { listEveryProject } from './use-project.ts';

const server = startServer();

describe('listEveryProject', () => {
  it('follows the cursor to the last page, so the newest projects are there too', async () => {
    const asked: (string | null)[] = [];
    const newest = { ...project, id: id(300), key: 'NEW', name: 'Newest' };
    server.use(
      http.get('*/api/v1/work/projects', ({ request }) => {
        const query = new URL(request.url).searchParams;
        asked.push(query.get('cursor'));
        return query.get('cursor') === 'next'
          ? HttpResponse.json({ items: [newest], nextCursor: null })
          : HttpResponse.json({ items: [project], nextCursor: 'next' });
      }),
    );
    const page = await listEveryProject();
    expect(page.items.map((item) => item.key)).toEqual(['PLT', 'NEW']);
    expect(page.nextCursor).toBeNull();
    expect(asked).toEqual([null, 'next']);
  });
});
