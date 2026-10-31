import { http as route, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { approvalEndpoints } from './endpoints/approvals.ts';
import { createApiClient, isApiError } from './index.ts';

const BASE = 'http://bemmoly.test';
const server = setupServer();
const absolute = (input: RequestInfo | URL, init?: RequestInit) =>
  fetch(new URL(String(input), BASE), init);
const ID = '018f0000-0000-7000-8000-0000000000a1';
const PERSON = '018f0000-0000-7000-8000-0000000000b2';

const request = {
  id: ID,
  moduleId: 'expenses',
  workflowKey: 'expenses.claim',
  workflowVersion: 2,
  subject: { kind: 'claim', id: 'c-1' },
  title: 'Flights to Berlin',
  url: null,
  requesterId: PERSON,
  fields: { amount: 640 },
  status: 'approved',
  currentStage: null,
  autoApproved: false,
  tasks: [],
  createdAt: '2026-10-22T09:00:00Z',
  updatedAt: '2026-10-22T09:05:00Z',
  closedAt: '2026-10-22T09:05:00Z',
};

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('approval endpoints', () => {
  it('lists what waits on me with the scope and module in the query', async () => {
    const seen = vi.fn();
    server.use(
      route.get(`${BASE}/api/v1/approval-requests`, ({ request: incoming }) => {
        seen(new URL(incoming.url).searchParams.toString());
        return HttpResponse.json({ items: [request], nextCursor: null });
      }),
    );
    const api = createApiClient({ fetch: absolute });
    const page = await approvalEndpoints(api.http).list({ scope: 'waiting', moduleId: 'expenses' });
    expect(page.items[0]?.workflowKey).toBe('expenses.claim');
    expect(seen).toHaveBeenCalledWith('scope=waiting&moduleId=expenses');
  });

  it('posts a decision and parses the request it answers with', async () => {
    const seen = vi.fn();
    server.use(
      route.post(
        `${BASE}/api/v1/approval-requests/${ID}/decisions`,
        async ({ request: incoming }) => {
          seen(await incoming.json());
          return HttpResponse.json(request, { status: 201 });
        },
      ),
    );
    const api = createApiClient({ fetch: absolute });
    const decided = await approvalEndpoints(api.http).decide(ID, {
      decision: 'approve',
      comment: 'Fine',
    });
    expect(decided.status).toBe('approved');
    expect(seen).toHaveBeenCalledWith({ decision: 'approve', comment: 'Fine' });
  });

  it('refuses a delegation that ends before it starts without calling the server', async () => {
    const api = createApiClient({ fetch: absolute });
    const error = await approvalEndpoints(api.http)
      .setDelegation({
        delegateId: PERSON,
        startsAt: new Date('2026-11-02'),
        endsAt: new Date('2026-11-01'),
      })
      .catch((caught: unknown) => caught);
    expect(isApiError(error) && error.code).toBe('validation_failed');
  });
});
