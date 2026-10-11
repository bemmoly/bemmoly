import { queryKeys } from '@bemmoly/api-client';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { id, newClient, providers, startServer } from '../test-support.tsx';
import { ConsistencyFindings } from './consistency-findings.tsx';

const PAGE = id(8801);
const { server } = startServer();

const check = (findings: unknown[], state = 'ready') => ({
  insight: {
    id: id(8802),
    kind: 'consistency',
    targetKind: 'page',
    targetId: PAGE,
    state,
    error: state === 'failed' ? 'The provider returned a rate limit' : null,
    generatedAt: '2026-10-10T09:00:00.000Z',
    feedback: null,
    content:
      state === 'ready'
        ? {
            output: { findings },
            citations: [
              {
                id: 'c1',
                kind: 'section',
                objectId: PAGE,
                label: 'Rollback',
                location: 'Rollback',
                href: `/docs/p/${PAGE}#rollback`,
              },
              {
                id: 'c2',
                kind: 'issue',
                objectId: id(8803),
                label: 'PLT-204',
                location: null,
                href: '/work/issue/PLT-204',
              },
            ],
            source: { counts: { paragraphs: 2 }, titlesOnly: false },
          }
        : null,
  },
});

const FINDING = {
  claim: 'Sessions stay valid for 15 minutes.',
  location: { heading: 'Rollback', paragraph: 6 },
  issueKey: 'PLT-204',
  field: 'description',
  issueValue: '30 minutes',
  confidence: 0.92,
  cites: ['c1', 'c2'],
};

function renderFindings(aiEnabled: boolean) {
  const client = newClient();
  client.setQueryData(queryKeys.me(), {
    user: { id: id(8804), name: 'Rohan S.' },
    workspace: { name: 'Acme', aiEnabled },
    capabilities: [],
    modules: ['docs'],
  });
  return render(<ConsistencyFindings pageId={PAGE} />, { wrapper: providers(client) });
}

describe('ConsistencyFindings', () => {
  it('lists each contradiction with both sources, where it is and how sure', async () => {
    server.use(
      http.get('*/api/v1/ai/insights/consistency/:id', () => HttpResponse.json(check([FINDING]))),
    );
    renderFindings(true);
    expect(
      await screen.findByText('“Sessions stay valid for 15 minutes.” PLT-204: 30 minutes'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Rollback' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'PLT-204' })).toBeTruthy();
    expect(screen.getByText('Rollback · description · 92% sure')).toBeTruthy();
    expect(screen.getByText('by AI · 1 found')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not useful' })).toBeTruthy();
  });

  it('draws nothing when the page agrees with its issues, or with AI off', async () => {
    let asked = 0;
    server.use(
      http.get('*/api/v1/ai/insights/consistency/:id', () => {
        asked += 1;
        return HttpResponse.json(check([]));
      }),
    );
    const agreed = renderFindings(true);
    await waitFor(() => expect(asked).toBe(1));
    await waitFor(() => expect(agreed.container.textContent).toBe(''));
    agreed.unmount();
    const off = renderFindings(false);
    expect(off.container.textContent).toBe('');
    expect(asked).toBe(1);
  });

  it("says it couldn't check the page, with Try again", async () => {
    server.use(
      http.get('*/api/v1/ai/insights/consistency/:id', () =>
        HttpResponse.json(check([], 'failed')),
      ),
    );
    renderFindings(true);
    expect(await screen.findByText('Couldn’t check the page')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
