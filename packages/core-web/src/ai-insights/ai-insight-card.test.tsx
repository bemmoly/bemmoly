import { ApiError, type Http } from '@bemmoly/api-client';
import type { AiInsight } from '@bemmoly/shared/ai-insights';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AiInsightCard } from './ai-insight-card.tsx';
import { useAiInsight } from './use-ai-insight.ts';

const TARGET = '00000000-0000-7000-8000-000000000204';

const summary = (change: Partial<AiInsight> = {}): AiInsight =>
  ({
    id: '00000000-0000-7000-8000-0000000000a1',
    kind: 'issue_summary',
    targetKind: 'issue',
    targetId: TARGET,
    state: 'ready',
    error: null,
    generatedAt: '2026-10-10T09:00:00.000Z',
    feedback: null,
    content: {
      output: {
        points: [
          { text: 'Review of PR 4821 waits on Jonas.', cites: ['c1'] },
          { text: 'It merges Friday.', cites: [] },
        ],
        next: [{ label: 'Open PLT-211', cite: 'c2' }],
      },
      citations: [
        {
          id: 'c1',
          kind: 'comment',
          objectId: 'k1',
          label: "Jonas M.'s comment",
          location: null,
          href: '/work/issue/PLT-204',
        },
        {
          id: 'c2',
          kind: 'issue',
          objectId: 'i2',
          label: 'PLT-211',
          location: null,
          href: '/work/issue/PLT-211',
        },
      ],
      source: { counts: { comments: 14, docs: 1 }, titlesOnly: false },
    },
    ...change,
  }) as AiInsight;

function fakeHttp(answer: () => Promise<unknown>) {
  const sent: string[] = [];
  const http = {
    request: vi.fn(async () => ({ insight: await answer() })),
    send: vi.fn(async (path: string) => void sent.push(path)),
  } as unknown as Http;
  return { http, sent };
}

function Card({ http, aiEnabled = true }: { http: Http; aiEnabled?: boolean }) {
  const handle = useAiInsight({ http, kind: 'issue_summary', targetId: TARGET, aiEnabled });
  return <AiInsightCard handle={handle} title="Summary" failedLabel="Couldn’t get a summary" />;
}

function renderCard(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe('AiInsightCard', () => {
  it('shows cited claims, an unsourced mark, what it read, the step and Not useful', async () => {
    const { http, sent } = fakeHttp(async () => summary());
    renderCard(<Card http={http} />);
    expect(await screen.findByText('Review of PR 4821 waits on Jonas.')).toBeTruthy();
    expect(screen.getByRole('link', { name: "Jonas M.'s comment" })).toBeTruthy();
    expect(screen.getByText('Unsourced')).toBeTruthy();
    expect(screen.getByText('by AI · from 14 comments, 1 doc')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open PLT-211' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Not useful' }));
    await waitFor(() => expect(sent).toEqual([`/api/v1/ai/insights/${summary().id}/feedback`]));
    expect(screen.getByRole('button', { name: 'Marked not useful' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('shows a skeleton while the summary is written', async () => {
    const { http } = fakeHttp(async () => summary({ state: 'pending', content: null, id: null }));
    renderCard(<Card http={http} />);
    expect(await screen.findByLabelText('Writing with AI')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Not useful' })).toBeNull();
  });

  it("says it couldn't get one, with the reason and Try again", async () => {
    const { http } = fakeHttp(async () =>
      summary({ state: 'failed', error: 'The provider returned a rate limit', content: null }),
    );
    renderCard(<Card http={http} />);
    expect(await screen.findByText('Couldn’t get a summary')).toBeTruthy();
    expect(screen.getByText('The provider returned a rate limit')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(http.request).toHaveBeenCalledWith(
        `/api/v1/ai/insights/issue_summary/${TARGET}/refresh`,
        expect.anything(),
        { method: 'POST' },
      ),
    );
  });

  it('draws nothing with AI off, and nothing when the server refuses', async () => {
    const off = fakeHttp(async () => summary());
    const { container } = renderCard(<Card http={off.http} aiEnabled={false} />);
    expect(container.innerHTML).toBe('');
    expect(off.http.request).not.toHaveBeenCalled();

    const refused = fakeHttp(async () => {
      throw new ApiError(403, 'forbidden', 'AI is turned off', { details: { reason: 'ai_off' } });
    });
    const second = renderCard(<Card http={refused.http} />);
    await waitFor(() => expect(refused.http.request).toHaveBeenCalled());
    await waitFor(() => expect(second.container.innerHTML).toBe(''));
  });
});
