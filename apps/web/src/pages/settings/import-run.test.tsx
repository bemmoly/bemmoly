import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { minutesLeft } from '../../hooks/use-import-run.ts';
import { importsApi } from '../../lib/imports-api.ts';
import { renderPage } from '../../test/render.tsx';
import { ImportPage } from './import-page.tsx';
import { click, startDefaultImport } from './import-test-steps.tsx';

const FINISH = { timeout: 8000 };

afterEach(() => vi.restoreAllMocks());

describe('Settings › Import: progress and done', () => {
  it('shows the overall bar and one row per project, the rest behind Show more', async () => {
    await startDefaultImport();
    const overall = await screen.findByRole('progressbar', { name: 'Import progress' });
    const rows = await screen.findByRole('list', { name: 'projects in this import' });
    expect(within(rows).getAllByRole('listitem')).toHaveLength(5);
    expect(within(rows).getByRole('progressbar', { name: 'Mobile apps progress' })).toBeDefined();
    await waitFor(() => expect(Number(overall.getAttribute('aria-valuenow'))).toBeGreaterThan(0), {
      timeout: 4000,
    });
    expect(screen.getByText(/of [\d,]+ issues/).getAttribute('aria-live')).toBe('polite');
    expect(
      screen.getByText('You can leave this page. Inbox tells you when it finishes.'),
    ).toBeDefined();
    const more = screen.getByRole('button', { name: 'Show 4 more' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    click(more);
    expect(within(rows).getAllByRole('listitem')).toHaveLength(9);
    expect(screen.getByRole('button', { name: 'Cancel import' })).toBeDefined();
  });

  it('lists a failed project first and retries only that one', async () => {
    const run = vi.spyOn(importsApi, 'run');
    await startDefaultImport('https://flaky.example.net');
    expect(await screen.findByText('8 of 9 projects imported.', {}, FINISH)).toBeDefined();
    expect(screen.getByText(/Mobile apps stopped partway/)).toBeDefined();
    const projects = screen.getByRole('list', { name: 'Projects' });
    const first = within(projects).getAllByRole('listitem')[0];
    expect(first?.textContent).toContain('Mobile apps');
    expect(first?.textContent).toContain('Jira kept answering "too many requests"');
    const retry = within(first as HTMLElement).getByRole('button', { name: 'Retry Mobile apps' });
    click(retry);
    await waitFor(() =>
      expect(run).toHaveBeenLastCalledWith(expect.any(String), { containers: ['10003'] }),
    );
    expect(await screen.findByText('All 9 projects imported.', {}, FINISH)).toBeDefined();
  });

  it('opens what each project went into and offers the skipped list as CSV', async () => {
    await startDefaultImport();
    await screen.findByText('All 9 projects imported.', {}, FINISH);
    const projects = screen.getByRole('list', { name: 'Projects' });
    const open = within(projects).getAllByRole('link', { name: /^Open board for/ })[0];
    expect(open?.getAttribute('href')).toMatch(/^\/work\/board\/[A-Z]+$/);
    const csv = screen.getByRole('link', { name: 'Download the list (CSV)' });
    expect(csv.getAttribute('href')).toMatch(/\/api\/v1\/admin\/imports\/[\w-]+\/skips\.csv$/);
    const skipped = screen.getByRole('region', { name: /Skipped/ });
    expect(skipped.textContent).toContain('PLT-90');
    expect(skipped.textContent).toContain('and 34 more in the list');
  });

  it('opens the job named in ?job=, as the Inbox link does', async () => {
    await startDefaultImport();
    await screen.findByText('All 9 projects imported.', {}, FINISH);
    const { items } = await importsApi.list();
    const id = items[0]?.id ?? '';
    cleanup();
    await renderPage(() => <ImportPage />, `/settings/import?job=${id}`);
    expect(await screen.findByText('All 9 projects imported.')).toBeDefined();
  });

  it('estimates minutes left only once there is a rate', () => {
    expect(minutesLeft(null, { at: 1000, done: 10 }, 100)).toBeNull();
    expect(minutesLeft({ at: 0, done: 10 }, { at: 0, done: 10 }, 100)).toBeNull();
    expect(minutesLeft({ at: 0, done: 0 }, { at: 60_000, done: 100 }, 1400)).toBe(13);
  });
});
