import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RUN_ROWS } from '../../hooks/use-import-run.ts';
import { importsApi } from '../../lib/imports-api.ts';
import { renderPage } from '../../test/render.tsx';
import { ImportPage } from './import-page.tsx';
import { click } from './import-test-steps.tsx';

/*
 * A run of more projects than one page holds: Done lists the first rows, Show more opens
 * the page that was read, and the next Show more reads the next page from the server.
 */

async function bigRun(): Promise<{ id: string; total: number }> {
  await renderPage(() => <ImportPage />, '/settings/import');
  const { items } = await importsApi.sources();
  const jira = items.find((source) => source.id === 'jira')!;
  const values = Object.fromEntries(
    jira.fields.map((field) => [
      field.name,
      field.kind === 'url' ? 'https://big.example.net' : field.kind === 'select' ? 'cloud' : 'x',
    ]),
  );
  const job = await importsApi.create({ source: 'jira', values });
  const summary = await importsApi.select(job.id, {
    ops: [{ select: true, scope: { filter: 'new' } }],
  });
  await importsApi.update(job.id, { onClash: 'suffix' });
  await importsApi.run(job.id);
  for (;;) {
    const now = await importsApi.get(job.id);
    if (now.status !== 'queued' && now.status !== 'running') break;
  }
  return { id: job.id, total: summary.selected };
}

describe('Settings › Import: a run of more than one page', () => {
  it('reads further pages of projects when Show more asks', async () => {
    const { id, total } = await bigRun();
    expect(total).toBeGreaterThan(RUN_ROWS * 2);
    await renderPage(() => <ImportPage />, `/settings/import?job=${id}`);
    const projects = await screen.findByRole('list', { name: 'Projects' }, { timeout: 8000 });
    const first = within(projects).getAllByRole('listitem').length;
    click(
      screen.getByRole('button', { name: `Show ${(total - first).toLocaleString('en')} more` }),
    );
    expect(within(projects).getAllByRole('listitem')).toHaveLength(RUN_ROWS);
    click(
      screen.getByRole('button', {
        name: `Show ${(total - RUN_ROWS).toLocaleString('en')} more`,
      }),
    );
    await waitFor(
      () => expect(within(projects).getAllByRole('listitem')).toHaveLength(RUN_ROWS * 2),
      { timeout: 4000 },
    );
  });
});
