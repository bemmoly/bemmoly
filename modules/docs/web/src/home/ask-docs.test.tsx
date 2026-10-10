import { queryKeys } from '@bemmoly/api-client';
import type { AiRole } from '@bemmoly/shared';
import type { AiAnswerEvent } from '@bemmoly/shared/ai-answers';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { listed, newClient, providers, space, startServer } from '../test-support.tsx';
import { docsKeys } from '../shared/keys.ts';
import DocsHomeScreen from './docs-home-screen.tsx';

const ME = '0199c0de-0000-7000-8000-000000000777';
const PAGE = '0199c0de-0000-7000-8000-000000000555';
const RUN = '0199c0de-0000-7000-8000-000000000999';

const SOURCES = [
  {
    id: 'c1',
    kind: 'docs.page',
    targetId: PAGE,
    title: 'RFC: Move sessions to Postgres',
    href: `/docs/p/${PAGE}#rollback`,
    location: { label: 'Rollback', anchor: 'rollback', part: 'body' as const },
    noun: { one: 'page', other: 'pages' },
  },
];

const TEXT = 'Flip auth_pg_sessions off [c1]. Most teams flip it back within the hour.';

const ndjson = (events: AiAnswerEvent[]) =>
  new HttpResponse(events.map((event) => `${JSON.stringify(event)}\n`).join(''), {
    headers: { 'content-type': 'application/x-ndjson' },
  });

const { server, calls } = startServer(
  http.get('*/api/v1/docs/spaces', () => HttpResponse.json(listed([space({ pageCount: 3 })]))),
  http.get('*/api/v1/docs/home/recent', () => HttpResponse.json(listed([]))),
  http.get('*/api/v1/docs/home/starred', () => HttpResponse.json(listed([]))),
  http.get('*/api/v1/docs/home/attention', () =>
    HttpResponse.json({ items: [], staleAfterDays: 90 }),
  ),
  http.get('*/api/v1/docs/templates', () => HttpResponse.json({ items: [] })),
  http.post('*/api/v1/ai/answers', () =>
    ndjson([
      { type: 'sources', sources: SOURCES },
      { type: 'delta', text: 'Flip auth_pg_sessions off [c1]. ' },
      { type: 'delta', text: 'Most teams flip it back within the hour.' },
      { type: 'done', outcome: 'answered', runId: RUN, text: TEXT, cited: ['c1'] },
    ]),
  ),
  http.put('*/api/v1/ai/runs/:id/feedback', () => new HttpResponse(null, { status: 204 })),
);

function renderHome(options: { ai: boolean; roles?: AiRole[]; admin?: boolean }) {
  const cache = newClient();
  cache.setQueryData(queryKeys.me(), {
    user: { id: ME, name: 'Priya N.' },
    workspace: { name: 'Acme Labs', aiEnabled: options.ai },
    capabilities: options.admin ? ['ai.models.configure'] : [],
  });
  cache.setQueryData(docsKeys.people(), listed([{ id: ME, name: 'Priya N.' }]));
  cache.setQueryData(queryKeys.ai.status(), {
    enabled: options.ai,
    optedOut: false,
    optOutAllowed: false,
    allowActions: true,
    availableRoles: options.roles ?? ['fast', 'standard', 'strong', 'embedding'],
    budgetState: 'ok',
  });
  render(<DocsHomeScreen segment={undefined} rest={[]} screen="home" />, {
    wrapper: providers(cache),
  });
}

async function askQuestion(question = 'How do we roll back?') {
  const box = await screen.findByRole('textbox', { name: 'Question about your docs' });
  fireEvent.change(box, { target: { value: question } });
  fireEvent.submit(box.closest('form')!);
}

describe('Ask your docs on the Docs home', () => {
  it('is not drawn at all while AI is off', async () => {
    renderHome({ ai: false });
    await screen.findAllByText('Engineering');
    expect(screen.queryByRole('region', { name: 'Ask your docs' })).toBeNull();
    expect(screen.queryByText(/Answers cite/)).toBeNull();
  });

  it('is not offered without an embedding model', async () => {
    renderHome({ ai: true, roles: ['fast', 'standard'] });
    await screen.findAllByText('Engineering');
    expect(screen.queryByRole('region', { name: 'Ask your docs' })).toBeNull();
  });

  it('streams a cited answer, marks the unsourced line and takes Not useful', async () => {
    renderHome({ ai: true });
    await askQuestion();
    const answer = await screen.findByRole('region', { name: 'AI answer' });
    expect(await within(answer).findByText('from 1 page')).toBeTruthy();
    const cite = within(answer).getByRole('link', { name: /Source 1: RFC: Move sessions/ });
    expect(cite.getAttribute('href')).toBe(`/docs/p/${PAGE}#rollback`);
    expect(within(answer).getByText('Unsourced')).toBeTruthy();
    expect(calls.some((call) => call.path === '/api/v1/ai/answers')).toBe(true);
    fireEvent.click(within(answer).getByRole('button', { name: 'Not useful' }));
    expect(await within(answer).findByText('Thanks. Noted as not useful.')).toBeTruthy();
    expect(calls.some((call) => call.path === `/api/v1/ai/runs/${RUN}/feedback`)).toBe(true);
  });

  it('says honestly when nothing in the docs answers', async () => {
    server.use(
      http.post('*/api/v1/ai/answers', () =>
        ndjson([
          { type: 'sources', sources: [] },
          { type: 'done', outcome: 'no_sources', runId: null, text: '', cited: [] },
        ]),
      ),
    );
    renderHome({ ai: true });
    await askQuestion('Who won the cup?');
    expect(await screen.findByText(/Nothing in your docs answers that yet/)).toBeTruthy();
  });

  it('names the provider when it is down and offers Try again', async () => {
    server.use(
      http.post('*/api/v1/ai/answers', () =>
        ndjson([
          { type: 'sources', sources: SOURCES },
          {
            type: 'error',
            error: {
              code: 'provider_error',
              message: 'down',
              details: {
                failure: 'unavailable',
                provider: 'Local server',
                providerMessage: null,
                retryAfterSeconds: 30,
              },
            },
          },
        ]),
      ),
    );
    renderHome({ ai: true });
    await askQuestion();
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Local server isn’t answering right now')).toBeTruthy();
    expect(within(alert).getByText(/Try again in 30 seconds/)).toBeTruthy();
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('explains a spent budget, and tells only admins where to change it', async () => {
    server.use(
      http.post('*/api/v1/ai/answers', () =>
        HttpResponse.json(
          {
            code: 'forbidden',
            message: 'budget',
            details: { reason: 'budget_reached', role: 'standard' },
            requestId: 'r',
          },
          { status: 403 },
        ),
      ),
    );
    renderHome({ ai: true });
    await askQuestion();
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('This month’s AI budget is spent')).toBeTruthy();
    expect(within(alert).getByText(/An admin can change that/)).toBeTruthy();
    expect(within(alert).queryByText(/Settings/)).toBeNull();
  });
});
