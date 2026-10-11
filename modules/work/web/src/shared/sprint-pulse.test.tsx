import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { me, Providers, startServer } from '../issue/test-support.tsx';
import { SprintPulse } from './sprint-pulse.tsx';

const SPRINT = '018f0000-0000-7000-8000-000000000b21';
const server = startServer();

const pulse = (state: string, change: Record<string, unknown> = {}) => ({
  insight: {
    id: '018f0000-0000-7000-8000-0000000000a2',
    kind: 'sprint_pulse',
    targetKind: 'sprint',
    targetId: SPRINT,
    state,
    error: null,
    generatedAt: state === 'ready' ? '2026-10-10T09:00:00.000Z' : null,
    feedback: null,
    content:
      state === 'ready'
        ? {
            output: {
              risk: 'at_risk',
              headline: {
                text: 'PLT-204 has been in review 3 days and blocks 2 issues.',
                cites: ['c1'],
              },
              next: [{ label: 'Open PLT-204', cite: 'c1' }],
            },
            citations: [
              {
                id: 'c1',
                kind: 'issue',
                objectId: 'i1',
                label: 'PLT-204',
                location: null,
                href: '/work/issue/PLT-204',
              },
            ],
            source: { counts: { issues: 12 }, titlesOnly: false },
          }
        : null,
    ...change,
  },
});

const answer = (body: ReturnType<typeof pulse>) =>
  server.use(
    http.get('*/api/v1/me', () => HttpResponse.json(me(true))),
    http.get('*/api/v1/ai/insights/sprint_pulse/:id', () => HttpResponse.json(body)),
  );

describe('SprintPulse', () => {
  it('names the risk in one line with its sources, a step, Not useful and Dismiss', async () => {
    answer(pulse('ready'));
    render(
      <Providers>
        <SprintPulse sprintId={SPRINT} />
      </Providers>,
    );
    expect(
      await screen.findByText('PLT-204 has been in review 3 days and blocks 2 issues.'),
    ).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Sprint risk' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'PLT-204' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open PLT-204' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not useful' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('region', { name: 'Sprint risk' })).toBeNull();
  });

  it('shows a skeleton while it is written and Try again when it failed', async () => {
    answer(pulse('pending'));
    const { unmount } = render(
      <Providers>
        <SprintPulse sprintId={SPRINT} />
      </Providers>,
    );
    expect(await screen.findByLabelText('Writing with AI')).toBeTruthy();
    unmount();
    answer(pulse('failed', { error: 'The provider returned a rate limit' }));
    render(
      <Providers>
        <SprintPulse sprintId={SPRINT} />
      </Providers>,
    );
    expect(await screen.findByText('Couldn’t get the sprint risk')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('draws nothing with AI off or without a running sprint', async () => {
    let asked = false;
    server.use(
      http.get('*/api/v1/me', () => HttpResponse.json(me(false))),
      http.get('*/api/v1/ai/insights/sprint_pulse/:id', () => {
        asked = true;
        return HttpResponse.json(pulse('ready'));
      }),
    );
    const { container } = render(
      <Providers>
        <SprintPulse sprintId={SPRINT} />
        <SprintPulse sprintId={undefined} />
      </Providers>,
    );
    await waitFor(() => expect(container.textContent).toBe(''));
    expect(asked).toBe(false);
  });
});
