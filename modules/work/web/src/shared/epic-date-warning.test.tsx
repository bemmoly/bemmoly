import { ToastProvider } from '@bemmoly/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { EpicDateWarning, type EpicDateWarningProps } from './epic-date-warning.tsx';

/** Every issue PATCH the warning's fixes sent, as key and body. */
const patches: Array<{ key: string; body: unknown }> = [];

const server = setupServer(
  http.patch('*/api/v1/work/issues/:key', async ({ params, request }) => {
    patches.push({ key: String(params['key']), body: await request.json() });
    return HttpResponse.json(
      { code: 'not_found', message: 'Gone', requestId: 't' },
      { status: 404 },
    );
  }),
);

beforeAll(() => server.listen());
afterEach(() => {
  cleanup();
  patches.length = 0;
  server.resetHandlers();
});
afterAll(() => server.close());

function show(props: EpicDateWarningProps) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <EpicDateWarning {...props} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const story = { key: 'PLT-9', startAt: '2026-12-03', dueAt: '2026-12-09' };
const epic = { key: 'PLT-1', endAt: '2026-12-01', targetField: 'dueAt' as const };

describe('EpicDateWarning', () => {
  it('says nothing while the story ends inside its epic', () => {
    show({ story: { ...story, startAt: null, dueAt: '2026-11-20' }, epic });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it("extends the epic's target to the story's last day", async () => {
    show({ story, epic: { ...epic, targetField: 'target_date' } });
    fireEvent.click(screen.getByRole('button', { name: /Ends 8 days after PLT-1/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Extend PLT-1 to Dec 9' }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({
      key: 'PLT-1',
      body: { customFields: { target_date: '2026-12-09' } },
    });
  });

  it("pulls the story's dates back to the epic's target", async () => {
    show({ story, epic });
    fireEvent.click(screen.getByRole('button', { name: /Fix the dates/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Move PLT-9 to end Dec 1' }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({
      key: 'PLT-9',
      body: { startAt: '2026-12-01', dueAt: '2026-12-01' },
    });
  });

  it('only names the problem for someone who cannot change dates', () => {
    show({ story, epic, canEdit: false });
    expect(screen.getByRole('button', { name: 'After PLT-1' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'After PLT-1' }));
    expect(screen.queryByRole('menuitem')).toBeNull();
  });
});
