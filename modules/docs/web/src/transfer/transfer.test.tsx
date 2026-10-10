import { queryKeys } from '@bemmoly/api-client';
import { Menu } from '@bemmoly/ui';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { id, newClient, providers, startServer } from '../test-support.tsx';
import { ExportDialog, useExportDialog } from './export-dialog.tsx';
import { ExportMenuItems } from './export-menu-items.tsx';
import { ImportDialog } from './import-dialog.tsx';
import { pickFiles, pickProblem, stripSharedRoot } from './read-files.ts';

const PAGE = id(900);

const { server, calls } = startServer();

/** A File with the folder path a folder pick gives it. */
function file(path: string, content = '# Title\n\nBody') {
  const made = new File([content], path.split('/').at(-1)!, { type: 'text/markdown' });
  Object.defineProperty(made, 'webkitRelativePath', { value: path.includes('/') ? path : '' });
  return made;
}

describe('picking files to import', () => {
  it('keeps the format’s files, drops the shared folder and sorts by path', () => {
    const picked = pickFiles('markdown', [
      file('export/runbooks/restore.md'),
      file('export/intro.md'),
      file('export/logo.png'),
      file('export/runbooks.md'),
    ]);
    expect(picked.map((entry) => entry.path)).toEqual([
      'intro.md',
      'runbooks.md',
      'runbooks/restore.md',
    ]);
    expect(
      pickFiles('confluence', [file('a.md'), file('b.html')]).map((entry) => entry.path),
    ).toEqual(['b.html']);
  });

  it('keeps paths from different folders as they are', () => {
    expect(stripSharedRoot(['a/x.md', 'b/y.md'])).toEqual(['a/x.md', 'b/y.md']);
    expect(stripSharedRoot(['x.md', 'a/y.md'])).toEqual(['x.md', 'a/y.md']);
  });

  it('says when a pick is too big for one import', () => {
    const big = new File(['x'], 'big.md');
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    expect(pickProblem(pickFiles('markdown', [big]))).toMatch(/10 MB/);
    expect(pickProblem(pickFiles('markdown', [file('ok.md')]))).toBeNull();
  });
});

describe('export', () => {
  const page = {
    id: PAGE,
    title: 'Runbook',
    hasChildren: true,
    deletedAt: null,
    snapshot: null,
  } as never;

  function renderDialog(capabilities: string[]) {
    const client = newClient();
    client.setQueryData(queryKeys.me(), {
      user: { id: id(901), name: 'R' },
      capabilities,
      modules: [],
      workspace: {},
    });
    render(<ExportDialog open page={page} onClose={() => undefined} />, {
      wrapper: providers(client),
    });
  }

  it('opens Export… from the More menu', () => {
    const client = newClient();
    render(
      <Menu defaultOpen trigger={(props) => <button {...props}>More</button>}>
        <ExportMenuItems page={page} />
      </Menu>,
      { wrapper: providers(client) },
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export…' }));
    expect(useExportDialog.getState().open).toBe(true);
    useExportDialog.getState().hide();
  });

  it('downloads the page as Markdown from the export route', () => {
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.getAttribute('href')).toBe(
        `/api/v1/docs/pages/${PAGE}/export?format=markdown&scope=page`,
      );
      expect(this.hasAttribute('download')).toBe(true);
    });
    renderDialog([]);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(clicked).toHaveBeenCalledOnce();
    clicked.mockRestore();
  });

  it('offers the subpages only to those who may export the space, and not for PDF', () => {
    renderDialog([]);
    expect(screen.queryByRole('checkbox', { name: /pages under it/ })).toBeNull();
    cleanup();
    renderDialog(['docs.space.export']);
    expect(screen.getByRole('checkbox', { name: /pages under it/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /PDF/ }));
    expect(screen.queryByRole('checkbox', { name: /pages under it/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open print view' })).toBeTruthy();
  });
});

describe('the import dialog', () => {
  const renderDialog = () =>
    render(
      <ImportDialog open onClose={() => undefined} space={{ key: 'ENG', name: 'Engineering' }} />,
      {
        wrapper: providers(newClient()),
      },
    );

  it('imports the picked Markdown files into the space', async () => {
    server.use(
      http.post('*/api/v1/docs/spaces/:key/imports', () =>
        HttpResponse.json({ status: 'queued', jobId: 'j1', idempotencyKey: 'k1' }, { status: 202 }),
      ),
    );
    renderDialog();
    fireEvent.change(screen.getByLabelText('Files to import', { selector: 'input' }), {
      target: { files: [file('intro.md', '# Intro'), file('notes.txt', 'plain'), file('pic.png')] },
    });
    expect(await screen.findByText('intro.md')).toBeTruthy();
    expect(screen.getByText(/1 file is not Markdown/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 files' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        path: '/api/v1/docs/spaces/ENG/imports',
        body: {
          format: 'markdown',
          files: [
            { path: 'intro.md', content: '# Intro' },
            { path: 'notes.txt', content: 'plain' },
          ],
        },
      }),
    );
    expect(await screen.findByText('Importing 2 files into Engineering')).toBeTruthy();
  });

  it('switches to a Confluence export and keeps only its pages', async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText('Files to import', { selector: 'input' }), {
      target: { files: [file('home.html', '<p>x</p>'), file('readme.md')] },
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Confluence export' }));
    expect(await screen.findByText('home.html')).toBeTruthy();
    expect(screen.queryByText('readme.md')).toBeNull();
    expect(screen.getByRole('button', { name: 'Import 1 file' })).toBeTruthy();
  });

  it('lists what each file became when a small import lands, then opens the pages', async () => {
    server.use(
      http.post('*/api/v1/docs/spaces/:key/imports', () =>
        HttpResponse.json(
          {
            status: 'completed',
            pages: [
              {
                id: id(950),
                parentId: null,
                title: 'Intro',
                path: 'intro.md',
                status: 'draft',
                placeholders: 2,
              },
            ],
          },
          { status: 201 },
        ),
      ),
    );
    renderDialog();
    fireEvent.change(screen.getByLabelText('Files to import', { selector: 'input' }), {
      target: { files: [file('intro.md', '# Intro')] },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Import 1 file' }));
    const results = await screen.findByRole('list', { name: 'Imported pages' });
    expect(results.textContent).toContain('2 macros kept as placeholders');
    expect(screen.getByRole('button', { name: 'Open pages' })).toBeTruthy();
  });
});
