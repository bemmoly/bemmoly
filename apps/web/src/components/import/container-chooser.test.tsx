import { ToastProvider } from '@bemmoly/ui';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImportPage } from '../../pages/settings/import-page.tsx';
import { renderPage } from '../../test/render.tsx';

const click = (element: HTMLElement, init?: MouseEventInit) =>
  act(() => fireEvent.click(element, init));
const type = (label: string | RegExp, value: string) =>
  act(() => fireEvent.change(screen.getByLabelText(label), { target: { value } }));
const key = (element: HTMLElement, init: KeyboardEventInit) =>
  act(() => fireEvent.keyDown(element, init));

async function connect(source: 'Jira' | 'Confluence', site = 'https://acme.example.net') {
  await renderPage(
    () => (
      <ToastProvider>
        <ImportPage />
      </ToastProvider>
    ),
    '/settings/import',
  );
  click(await screen.findByRole('radio', { name: new RegExp(source) }));
  type('Site address', site);
  type('Account email', 'rohan@acmelabs.dev');
  type('API token', 'a-token');
  click(screen.getByRole('button', { name: 'Connect' }));
}

const list = () => screen.findByRole('listbox', {}, { timeout: 3000 });
const option = (text: string) => {
  const found = screen.getAllByRole('option').find((row) => row.textContent?.includes(text));
  if (!found) throw new Error(`${text} is not listed`);
  return found;
};
const ticked = (text: string) => option(text).getAttribute('aria-selected') === 'true';
const total = (n: number) =>
  screen.findByRole('button', { name: `Continue with ${n}` }, { timeout: 3000 });
const selectAll = () =>
  screen.getByRole('checkbox', { name: 'Select all shown' }) as HTMLInputElement;
const activeRow = (box: HTMLElement) =>
  document.getElementById(box.getAttribute('aria-activedescendant') ?? '');

describe('Choose projects', () => {
  it('moves with the arrow and page keys and ticks with Space', async () => {
    await connect('Jira');
    const box = await list();
    await total(9);
    expect(box.getAttribute('aria-multiselectable')).toBe('true');
    expect(activeRow(box)?.textContent).toContain('Platform');
    key(box, { key: 'ArrowDown' });
    expect(activeRow(box)?.textContent).toContain('Support desk');
    key(box, { key: 'End' });
    expect(activeRow(box)?.textContent).toContain('Legal requests');
    key(box, { key: 'Home' });
    key(box, { key: 'PageDown' });
    expect(activeRow(box)?.textContent).toContain('Design system');
    key(box, { key: 'PageUp' });
    expect(ticked('Platform')).toBe(false);
    key(box, { key: ' ' });
    expect(ticked('Platform')).toBe(true);
    await total(10);
  });

  it('ticks a range with Shift+Space and Shift-click, and extends with Shift+Arrow', async () => {
    await connect('Jira');
    const box = await list();
    await total(9);
    click(option('Mobile apps'));
    expect(ticked('Mobile apps')).toBe(false);
    click(option('Data pipeline'), { shiftKey: true });
    expect(ticked('Web storefront')).toBe(false);
    expect(ticked('Data pipeline')).toBe(false);
    key(box, { key: 'Home' });
    key(box, { key: ' ' });
    key(box, { key: 'ArrowDown', shiftKey: true });
    key(box, { key: 'ArrowDown', shiftKey: true });
    expect(ticked('Mobile apps')).toBe(true);
    // Shift+Space sets the range from the anchor to what the row it lands on becomes.
    key(box, { key: 'End' });
    key(box, { key: ' ', shiftKey: true });
    expect(ticked('Legal requests')).toBe(false);
    await total(0);
  });

  it('shows a tri-state select all; Mod+A ticks all shown, clearing offers Undo', async () => {
    await connect('Jira');
    const box = await list();
    await total(9);
    expect(selectAll().getAttribute('aria-checked')).toBe('mixed');
    key(box, { key: 'a', metaKey: true });
    await total(12);
    expect(selectAll().checked).toBe(true);
    expect(selectAll().getAttribute('aria-checked')).toBeNull();
    click(selectAll());
    await total(0);
    expect(selectAll().checked).toBe(false);
    const toast = await screen.findByText('Cleared 12 projects');
    expect(toast).toBeDefined();
    click(screen.getByRole('button', { name: 'Undo' }));
    await total(12);
    expect(ticked('Mobile apps')).toBe(true);
  });

  it('undoes a clear with Mod+Z', async () => {
    await connect('Jira');
    const box = await list();
    await total(9);
    click(screen.getByRole('button', { name: 'Clear' }));
    await total(0);
    expect(ticked('Mobile apps')).toBe(false);
    key(box, { key: 'z', ctrlKey: true });
    await total(9);
    expect(ticked('Mobile apps')).toBe(true);
  });

  it('locks rows the token cannot read and explains them', async () => {
    await connect('Jira');
    await list();
    await total(9);
    const locked = option('People operations');
    expect(locked.getAttribute('aria-disabled')).toBe('true');
    click(locked);
    expect(ticked('People operations')).toBe(false);
    expect(
      screen.getByText(/People operations and Finance close can't be read with this token/),
    ).toBeDefined();
  });

  it('searches on the server, clears with Esc and says when nothing matches', async () => {
    await connect('Jira');
    await list();
    const search = screen.getByRole('searchbox', { name: 'Search projects' });
    await act(async () => fireEvent.change(search, { target: { value: 'data' } }));
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1), { timeout: 2000 });
    expect(option('Data pipeline')).toBeDefined();
    const filters = screen.getByRole('radiogroup', { name: 'Show' });
    expect(within(filters).queryByRole('radio', { name: /No access/ })).toBeNull();
    key(search, { key: 'Escape' });
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(10));
    await act(async () => fireEvent.change(search, { target: { value: 'zzz' } }));
    expect(await screen.findByText('No projects match “zzz”', {}, { timeout: 2000 })).toBeDefined();
    click(screen.getByRole('button', { name: 'Clear search' }));
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(10));
  });

  it('filters with counts', async () => {
    await connect('Jira');
    await list();
    const filters = screen.getByRole('radiogroup', { name: 'Show' });
    click(within(filters).getByRole('radio', { name: /Imported before\s*2/ }));
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
    expect(option('Infrastructure').textContent).toContain('Imported Oct 2');
  });

  it('explains a token that sees nothing, with a way back', async () => {
    await connect('Jira', 'https://empty.example.net');
    expect(
      await screen.findByRole('heading', { name: "This token can't see any projects" }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeDefined();
    click(screen.getByRole('button', { name: 'Change connection' }));
    expect(await screen.findByLabelText('Site address')).toBeDefined();
  });

  it('counts a big site lazily and ticks nothing to start', async () => {
    await connect('Jira', 'https://big.example.net');
    await list();
    expect(screen.getByText(/1,240 projects\./)).toBeDefined();
    expect(screen.getAllByRole('img', { name: 'Counting' }).length).toBeGreaterThan(0);
    await waitFor(
      () => expect(screen.queryAllByRole('img', { name: 'Counting' })).toHaveLength(0),
      {
        timeout: 2000,
      },
    );
    await total(0);
  });

  it('says spaces and pages for Confluence, with personal spaces unticked', async () => {
    await connect('Confluence', 'https://acme.example.net/wiki');
    await list();
    expect(screen.getByRole('region', { name: /Choose spaces/ })).toBeDefined();
    expect(ticked('~rohan')).toBe(false);
    expect(ticked('Product')).toBe(true);
    expect(screen.getByText(/Legal can't be read with this token/)).toBeDefined();
    await waitFor(() =>
      expect(screen.getByText(/pages/, { selector: 'span[aria-live]' })).toBeDefined(),
    );
  });
});
