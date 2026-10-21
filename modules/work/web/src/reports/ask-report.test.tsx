import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AskReport } from './ask-report.tsx';
import { PinnedReports } from './pinned-reports.tsx';
import { reportCsv, reportFileName } from './report-export.ts';

/* Asking for a report and pinning it, against a mock backend standing in for the model. */

const SPEC = {
  title: 'Open issues by person',
  metric: 'open_issues',
  groupBy: 'assignee',
  filters: { status: 'open' },
  chart: 'bar',
} as const;

const RESULT = {
  spec: SPEC,
  unit: 'issues',
  rows: [
    { id: 'u1', label: 'Ana', value: 4, issues: 4 },
    { id: null, label: 'Unassigned', value: 1, issues: 1 },
  ],
  total: 5,
  issues: 5,
  generatedAt: '2026-10-21T09:00:00.000Z',
} as const;

const PIN_ID = '0199c0de-0000-7000-8000-0000000000b1';
const PROJECT_ID = '0199c0de-0000-7000-8000-0000000000aa';

let questions: string[] = [];
let pinned: unknown[] = [];
const server = setupServer(
  http.post('*/api/v1/work/projects/PLT/reports/ask', async ({ request }) => {
    const body = (await request.json()) as { question: string };
    questions.push(body.question);
    return HttpResponse.json({ question: body.question, result: RESULT, runId: 'run-1' });
  }),
  http.get('*/api/v1/work/projects/PLT/pinned-reports', () => HttpResponse.json({ items: pinned })),
  http.post('*/api/v1/work/projects/PLT/pinned-reports', async ({ request }) => {
    const body = (await request.json()) as { question: string; spec: typeof SPEC };
    const pin = {
      id: PIN_ID,
      projectId: PROJECT_ID,
      question: body.question,
      spec: body.spec,
      createdAt: '2026-10-21T09:00:00.000Z',
    };
    pinned.push({ ...pin, result: RESULT, error: null });
    return HttpResponse.json(pin, { status: 201 });
  }),
  http.delete('*/api/v1/work/pinned-reports/:id', () => {
    pinned = [];
    return new HttpResponse(null, { status: 204 });
  }),
);

beforeAll(() => server.listen());
beforeEach(() => {
  questions = [];
  pinned = [];
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function renderBoth() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AskReport projectKey="PLT" />
      <PinnedReports projectKey="PLT" />
    </QueryClientProvider>,
  );
}

describe('Ask for a report', () => {
  it('asks the question, shows how it was read, and pins it to the view', async () => {
    renderBoth();
    fireEvent.change(screen.getByLabelText('Question about this project'), {
      target: { value: 'How loaded is each person?' },
    });
    fireEvent.submit(screen.getByRole('search', { name: 'Ask for a report' }));
    expect(await screen.findByRole('heading', { name: 'Open issues by person' })).toBeTruthy();
    expect(questions).toEqual(['How loaded is each person?']);
    expect(screen.getByText('Open issues · by assignee · not done')).toBeTruthy();
    expect(screen.getByText('by AI · built from 5 issues you can see')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Pinned' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Pin to reports' }));
    expect(await screen.findByRole('region', { name: 'Pinned' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pinned' })).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('button', { name: 'Unpin' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Pinned' })).toBeNull());
  });

  it('asks an example question with one click', async () => {
    renderBoth();
    fireEvent.click(screen.getByRole('button', { name: 'How loaded is each person?' }));
    await screen.findByRole('heading', { name: 'Open issues by person' });
    expect(questions).toEqual(['How loaded is each person?']);
  });

  it('says what went wrong and offers to try again', async () => {
    server.use(
      http.post('*/api/v1/work/projects/PLT/reports/ask', () =>
        HttpResponse.json(
          { code: 'forbidden', message: 'AI is off for this workspace', requestId: 'r' },
          { status: 403 },
        ),
      ),
    );
    renderBoth();
    fireEvent.click(screen.getByRole('button', { name: 'How loaded is each person?' }));
    expect(await screen.findByText(/Couldn’t build that report/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('report export', () => {
  it('writes CSV a spreadsheet opens safely', () => {
    const csv = reportCsv({
      ...RESULT,
      rows: [{ id: 'x', label: '=HYPERLINK("x"), "quoted"', value: 2, issues: 2 }],
    } as never);
    expect(csv).toBe('Group,Issues,Issues counted\r\n"\'=HYPERLINK(""x""), ""quoted""",2,2\r\n');
    expect(reportFileName('Open issues by person', 'png')).toBe('open-issues-by-person.png');
    expect(reportFileName('???', 'csv')).toBe('report.csv');
  });
});
