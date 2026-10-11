import { queryKeys } from '@bemmoly/api-client';
import { Menu } from '@bemmoly/ui';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { id, newClient, providers, startServer } from '../test-support.tsx';
import { ExportDialog, useExportDialog } from './export-dialog.tsx';
import { ExportMenuItems } from './export-menu-items.tsx';

const PAGE = id(910);
const EXPORT = id(911);
const { server, calls } = startServer();

const page = {
  id: PAGE,
  title: 'Runbook',
  hasChildren: true,
  deletedAt: null,
  snapshot: null,
} as never;

const renderer = (pdf: boolean) =>
  http.get('*/api/v1/docs/exports/options', () => HttpResponse.json({ pdf }));

const pdfExport = (status: 'queued' | 'ready', scope: 'page' | 'subtree' = 'page') => ({
  id: EXPORT,
  pageId: PAGE,
  scope,
  paper: 'letter',
  status,
  fileName: 'runbook.pdf',
  pages: 1,
  size: status === 'ready' ? 1024 : null,
  downloadUrl: status === 'ready' ? `/api/v1/docs/exports/${EXPORT}/file` : null,
  error: null,
  createdAt: '2026-10-11T10:00:00.000Z',
  expiresAt: '2026-10-12T10:00:00.000Z',
});

function client(capabilities: string[] = []) {
  const made = newClient();
  made.setQueryData(queryKeys.me(), {
    user: { id: id(912), name: 'R' },
    capabilities,
    modules: [],
    workspace: {},
  });
  return made;
}

function renderMenu() {
  render(
    <Menu defaultOpen trigger={(props) => <button {...props}>More</button>}>
      <ExportMenuItems page={page} />
    </Menu>,
    { wrapper: providers(client()) },
  );
}

describe('Export as PDF in the More menu', () => {
  it('is hidden when the install has no PDF renderer', async () => {
    server.use(renderer(false));
    renderMenu();
    expect(await screen.findByRole('menuitem', { name: 'Export…' })).toBeTruthy();
    await waitFor(() => expect(calls).toEqual([]));
    expect(screen.queryByRole('menuitem', { name: 'Export as PDF' })).toBeNull();
  });

  it('is hidden when the answer does not come', async () => {
    renderMenu();
    expect(await screen.findByRole('menuitem', { name: 'Export…' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Export as PDF' })).toBeNull();
  });

  it('opens Export… on PDF when the renderer runs', async () => {
    server.use(renderer(true));
    renderMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Export as PDF' }));
    expect(useExportDialog.getState()).toMatchObject({ open: true, format: 'pdf' });
    useExportDialog.getState().hide();
  });
});

describe('the export dialog with the PDF renderer', () => {
  it('makes a one-page PDF on Letter and downloads it when ready', async () => {
    let polls = 0;
    server.use(
      renderer(true),
      http.post('*/api/v1/docs/pages/:pageId/exports', () =>
        HttpResponse.json(pdfExport('queued'), { status: 202 }),
      ),
      http.get('*/api/v1/docs/exports/:exportId', () => {
        polls += 1;
        return HttpResponse.json(pdfExport('ready'));
      }),
    );
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<ExportDialog open initialFormat="pdf" page={page} onClose={() => undefined} />, {
      wrapper: providers(client()),
    });
    expect(await screen.findByText('A file with page numbers, ready to share')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Letter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(clicked).toHaveBeenCalledOnce(), { timeout: 4000 });
    expect(calls).toContainEqual({
      method: 'POST',
      path: `/api/v1/docs/pages/${PAGE}/exports`,
      body: { scope: 'page', paper: 'letter' },
    });
    expect(polls).toBeGreaterThan(0);
    expect((clicked.mock.instances[0] as unknown as HTMLAnchorElement).getAttribute('href')).toBe(
      `/api/v1/docs/exports/${EXPORT}/file`,
    );
    clicked.mockRestore();
  });

  it('offers the pages under it for a PDF and sends the subtree to the inbox', async () => {
    server.use(
      renderer(true),
      http.post('*/api/v1/docs/pages/:pageId/exports', () =>
        HttpResponse.json(pdfExport('queued', 'subtree'), { status: 202 }),
      ),
    );
    render(<ExportDialog open initialFormat="pdf" page={page} onClose={() => undefined} />, {
      wrapper: providers(client(['docs.space.export'])),
    });
    fireEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Include the pages under it, with a contents page',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(await screen.findByText('Making your PDF')).toBeTruthy();
    expect(calls).toContainEqual({
      method: 'POST',
      path: `/api/v1/docs/pages/${PAGE}/exports`,
      body: { scope: 'subtree', paper: 'a4' },
    });
  });
});
