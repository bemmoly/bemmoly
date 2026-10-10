import { queryKeys } from '@bemmoly/api-client';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { docsKeys } from '../shared/keys.ts';
import {
  id,
  listed,
  newClient,
  providers,
  space,
  SPACE_ID,
  startServer,
} from '../test-support.tsx';
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
const RUN = id(650);
const FIXED = comment('Rotate them sooner.', {
  anchor: anchor('every month'),
  anchorStatus: 'anchored',
  aiSuggestion: { replacement: 'every 30 days', rationale: 'Policy says 30.', runId: RUN },
});

let refuse = true;
let threads = [ASK, MOVED, GENERAL];
/* The fix stays "being written" until a test lets it through: no real waits. */
let release = () => {};
const { calls } = startServer(
  http.get('*/api/v1/docs/pages/:pageId/comments', () => HttpResponse.json(listed(threads))),
  http.post('*/api/v1/docs/comments/:id/suggest-fix', async () => {
    if (refuse) {
      return HttpResponse.json(
        { code: 'forbidden', message: 'x', details: { reason: 'excluded' }, requestId: 't' },
        { status: 403 },
      );
    }
    await new Promise<void>((resolve) => (release = resolve));
    return HttpResponse.json({
      ...ASK,
      aiSuggestion: { replacement: 'every 90 days', rationale: 'Policy says 90 days.' },
    });
  }),
  http.put('*/api/v1/ai/runs/:id/feedback', () => new HttpResponse(null, { status: 204 })),
);

afterEach(() => {
  release();
  useCommentUi.getState().reset(PAGE);
  refuse = true;
  threads = [ASK, MOVED, GENERAL];
});

interface Seed {
  aiEnabled?: boolean;
  /** The space's own "exclude from AI" switch. */
  spaceExcluded?: boolean;
  /** Settings › AI › Privacy excludes the space. */
  policyExcluded?: boolean;
}

function renderRail({ aiEnabled = true, spaceExcluded = false, policyExcluded = false }: Seed) {
  const client = newClient();
  client.setQueryData(queryKeys.me(), {
    user: ME,
    capabilities: [],
    modules: [],
    workspace: { aiEnabled },
  });
  client.setQueryData(docsKeys.page(PAGE), { id: PAGE, spaceKey: 'ENG' });
  client.setQueryData(docsKeys.space('ENG'), space({ aiExcluded: spaceExcluded }));
  client.setQueryData(queryKeys.ai.status(), {
    enabled: aiEnabled,
    optedOut: false,
    optOutAllowed: false,
    ghostText: true,
    excludedSpaceIds: policyExcluded ? [SPACE_ID] : [],
    excludedProjectIds: [],
    allowActions: true,
    availableRoles: ['fast', 'standard'],
    budgetState: 'unlimited',
  });
  render(<CommentsRail pageId={PAGE} canComment />, { wrapper: providers(client) });
}

const card = async (text: string) => (await screen.findByText(text)).closest('article')!;

describe('Suggest a fix', () => {
  it('shows only on a thread whose text is still there, and only with AI on', async () => {
    renderRail({});
    const thread = within(await card('every year'));
    expect(thread.getByRole('button', { name: 'Suggest a fix' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Suggest a fix' })).toHaveLength(1);
  });

  it('is not there at all with AI off', async () => {
    renderRail({ aiEnabled: false });
    await card('every year');
    expect(screen.queryByRole('button', { name: 'Suggest a fix' })).toBeNull();
  });

  it('says a refusal plainly, then shows the fix being written', async () => {
    renderRail({});
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

  it('is not offered in a space excluded from AI, by its own switch or by Privacy', async () => {
    renderRail({ spaceExcluded: true });
    await card('every year');
    expect(screen.queryByRole('button', { name: 'Suggest a fix' })).toBeNull();
    cleanup();

    renderRail({ policyExcluded: true });
    await card('every year');
    expect(screen.queryByRole('button', { name: 'Suggest a fix' })).toBeNull();
  });

  it('marks a written fix not useful, once', async () => {
    threads = [FIXED];
    renderRail({});
    const thread = within(await card('every month'));
    expect(thread.getByText(/Replace with “every 30 days”/)).toBeTruthy();
    fireEvent.click(thread.getByRole('button', { name: 'Not useful' }));
    const marked = await thread.findByRole('button', { name: 'Marked not useful' });
    expect((marked as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'PUT',
        path: `/api/v1/ai/runs/${RUN}/feedback`,
        body: { feedback: 'not_useful' },
      }),
    );
    // The fix itself stays, to apply or leave.
    expect(thread.getByRole('button', { name: 'Apply fix' })).toBeTruthy();
  });
});
