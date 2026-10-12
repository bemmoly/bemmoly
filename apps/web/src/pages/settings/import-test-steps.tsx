import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import { renderPage } from '../../test/render.tsx';
import { ImportPage } from './import-page.tsx';

/** The steps the Settings › Import tests share: connect, choose, fix the taken key, review. */

export const click = (element: HTMLElement) => act(() => fireEvent.click(element));
export const type = (label: string | RegExp, value: string) =>
  act(() => fireEvent.change(screen.getByLabelText(label), { target: { value } }));

export async function connectToJira(token = 'a-token', site = 'https://acme.example.net') {
  await renderPage(() => <ImportPage />, '/settings/import');
  click(await screen.findByRole('radio', { name: /Jira/ }));
  type('Site address', site);
  type('Account email', 'rohan@acmelabs.dev');
  type('API token', token);
  click(screen.getByRole('button', { name: 'Connect' }));
}

export const continueButton = (n: number) =>
  screen.findByRole('button', { name: `Continue with ${n}` }, { timeout: 3000 });

/** Options: SUP's key is taken by Support Desk, so give it another, then Review. */
export async function fixSupAndReview() {
  const key = await screen.findByRole('textbox', { name: 'Key for Support desk' });
  expect(key.getAttribute('aria-invalid')).toBe('true');
  act(() => fireEvent.change(key, { target: { value: 'SUPD' } }));
  const review = screen.getByRole('button', { name: 'Review import' });
  await waitFor(() => expect(review.hasAttribute('disabled')).toBe(false), { timeout: 3000 });
  click(review);
  return screen.findByRole('region', { name: /Review/ });
}

/** Connect, keep the default nine, fix SUP, Start import. */
export async function startDefaultImport(site?: string) {
  await connectToJira('a-token', site);
  click(await continueButton(9));
  await fixSupAndReview();
  click(await screen.findByRole('button', { name: 'Start import' }));
}
