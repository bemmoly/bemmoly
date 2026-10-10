import { queryKeys } from '@bemmoly/api-client';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { id, listed, newClient, providers, startServer } from '../test-support.tsx';
import { useCommentUi } from './comment-store.ts';
import { CommentsRail } from './comments-rail.tsx';

/*
 * "Suggest a fix" on a thread: lilac, only with AI on, only on a thread whose text is still
 * on the page, and honest when the server refuses.
 */

const PAGE = id(600);
const ME = { id: id(601), name: 'Rohan Sharma' };
const at = '2026-10-01T10:00:00.000Z';

function comment(text: string, overrides: Record<string, unknown> = {}) {
  return {
    id: id(),
    pageId: PAGE,
    parentId: null,
    author: ME,
    body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
    bodyText: text,
    anchor: null,
    anchorStatus: null,
    aiSuggestion: null,
    resolvedAt: null,
    resolvedBy: null,
    editedAt: null,
    createdAt: at,
    ...overrides,
  };
}

const anchor = (quote: string) => ({ from: 'AQID', to: 'BAUG', quote });
const ASK = comment('Is a year too long?', {
  anchor: anchor('every year'),
  anchorStatus: 'anchored',
});
const MOVED = comment('This line was rewritten.', {
  anchor: anchor('old words'),
  anchorStatus: 'text_changed',
});
const GENERAL = comment('Looks good overall.');

let refuse = true;
const { calls } = startServer(
  http.get('*/api/v1/docs/pages/:pageId/comments', () =>
    HttpResponse.json(listed([ASK, MOVED, GENERAL])),
  ),
  http.post('*/api/v1/docs/comments/:id/suggest-fix', async () => {
    if (refuse) {
      return HttpResponse.json(
        { code: 'forbidden', message: 'x', details: { reason: 'excluded' }, requestId: 't' },
        { status: 403 },
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
    return HttpResponse.json({
      ...ASK,
      aiSuggestion: { replacement: 'every 90 days', rationale: 'Policy says 90 days.' },
    });
  }),
);

afterEach(() => {
  useCommentUi.getState().reset(PAGE);
  refuse = true;
});

function renderRail(aiEnabled: boolean) {
  const client = newClient();
  client.setQueryData(queryKeys.me(), {
    user: ME,
    capabilities: [],
    modules: [],
    workspace: { aiEnabled },
  });
  render(<CommentsRail pageId={PAGE} canComment />, { wrapper: providers(client) });
}

const card = async (text: string) => (await screen.findByText(text)).closest('article')!;

describe('Suggest a fix', () => {
  it('shows only on a thread whose text is still there, and only with AI on', async () => {
    renderRail(true);
    const thread = within(await card('every year'));
    expect(thread.getByRole('button', { name: 'Suggest a fix' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Suggest a fix' })).toHaveLength(1);
  });

  it('is not there at all with AI off', async () => {
    renderRail(false);
    await card('every year');
    expect(screen.queryByRole('button', { name: 'Suggest a fix' })).toBeNull();
  });

  it('says a refusal plainly, then shows the fix being written', async () => {
    renderRail(true);
    const thread = within(await card('every year'));
    fireEvent.click(thread.getByRole('button', { name: 'Suggest a fix' }));
    expect(
      await screen.findByText('This space is excluded from AI, so nothing on this page is sent.'),
    ).toBeTruthy();
    expect(calls.map((call) => call.path)).toContain(`/api/v1/docs/comments/${ASK.id}/suggest-fix`);

    refuse = false;
    fireEvent.click(thread.getByRole('button', { name: 'Suggest a fix' }));
    expect(await screen.findByText('Writing a fix…')).toBeTruthy();
  });
});
