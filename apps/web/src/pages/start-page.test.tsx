import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { aiOf } from '../mocks/routes/ai-state.ts';
import { renderPage } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import { useUiStore } from '../store/ui.ts';
import { StartPage } from './start-page.tsx';

describe('the start page', () => {
  it('shows each product with what waits there, what needs the person and their recents', async () => {
    await renderPage(() => <StartPage />, '/start');
    expect(await screen.findByRole('heading', { level: 1, name: /Rohan$/ })).toBeTruthy();
    const work = await screen.findByTestId('start-product-work');
    await waitFor(() => expect(work.textContent).toMatch(/\d+ issues? assigned to you/));
    expect(screen.getByTestId('start-product-docs').textContent).toContain('Docs');

    const needs = screen.getByRole('region', { name: 'Needs you' });
    const due = await within(needs).findByRole('link', { name: /PLT-190/ });
    expect(due.getAttribute('href')).toBe('/work/issue/PLT-190');

    const recent = screen.getByRole('region', { name: 'Recent' });
    await waitFor(() => expect(within(recent).getAllByRole('link').length).toBeGreaterThan(1));
    expect(within(recent).getByRole('link', { name: /Postmortem: checkout outage/ })).toBeTruthy();
  });

  it('hands a question to ⌘K, with the AI dot only while AI is on', async () => {
    await renderPage(() => <StartPage />, '/start');
    const box = await screen.findByTestId('start-ask');
    await waitFor(() =>
      expect(box.getAttribute('placeholder')).toBe('Ask anything, or tell Bemmoly what you need…'),
    );
    fireEvent.change(box, { target: { value: 'Who owns the auth service?' } });
    fireEvent.submit(box.closest('form')!);
    expect(useUiStore.getState()).toMatchObject({
      paletteOpen: true,
      paletteQuery: 'Who owns the auth service?',
    });
  });

  it('is a plain search box while AI is off', async () => {
    aiOf(mockApi.db).settings.privacy.enabled = false;
    await renderPage(() => <StartPage />, '/start');
    const box = await screen.findByTestId('start-ask');
    await waitFor(() =>
      expect(box.getAttribute('placeholder')).toBe('Search issues, pages and people…'),
    );
    expect(document.querySelector('.bg-ai')).toBeNull();
  });

  it('lists only the products the person can use', async () => {
    mockApi.db.manifests = mockApi.db.manifests.filter((manifest) => manifest.id === 'docs');
    await renderPage(() => <StartPage />, '/start');
    await screen.findByTestId('start-product-docs');
    expect(screen.queryByTestId('start-product-work')).toBeNull();
  });
});
