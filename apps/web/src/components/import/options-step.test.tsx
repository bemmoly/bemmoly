import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KEY_RULE } from '../../hooks/use-import-targets.ts';
import { importsApi } from '../../lib/imports-api.ts';
import { ImportPage } from '../../pages/settings/import-page.tsx';
import { renderPage } from '../../test/render.tsx';

const click = (element: HTMLElement) => act(() => fireEvent.click(element));
const typeIn = (element: HTMLElement, value: string) =>
  act(() => fireEvent.change(element, { target: { value } }));

/** Connects to the everyday Jira site and continues with the nine default projects. */
async function openOptions() {
  await renderPage(() => <ImportPage />, '/settings/import');
  click(await screen.findByRole('radio', { name: /Jira/ }));
  typeIn(screen.getByLabelText('Site address'), 'https://acme.example.net');
  typeIn(screen.getByLabelText('Account email'), 'rohan@acmelabs.dev');
  typeIn(screen.getByLabelText('API token'), 'a-token');
  click(screen.getByRole('button', { name: 'Connect' }));
  click(await screen.findByRole('button', { name: 'Continue with 9' }, { timeout: 3000 }));
  return screen.findByRole('textbox', { name: 'Key for Support desk' }, { timeout: 3000 });
}

const reviewButton = () => screen.getByRole('button', { name: 'Review import' });
const enabled = (button: HTMLElement) =>
  waitFor(() => expect(button.hasAttribute('disabled')).toBe(false), { timeout: 3000 });

afterEach(() => vi.restoreAllMocks());

describe('Import options', () => {
  it('blocks Review while a key is taken and clears the error when the key changes', async () => {
    const key = await openOptions();
    expect(key.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText(/SUP is taken by Support Desk \(a Work project\)/)).toBeDefined();
    expect(reviewButton().hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Fix the key for SUP to continue.')).toBeDefined();

    typeIn(key, 's');
    expect(screen.getByText(KEY_RULE)).toBeDefined();
    expect(reviewButton().hasAttribute('disabled')).toBe(true);

    typeIn(key, 'supd');
    expect((key as HTMLInputElement).value).toBe('SUPD');
    await waitFor(() => expect(key.getAttribute('aria-invalid')).toBeNull(), { timeout: 3000 });
    await enabled(reviewButton());
    expect(screen.getByText('The key becomes SUPD.')).toBeDefined();
  });

  it('sends a project into an existing one from the picker', async () => {
    await openOptions();
    const group = screen.getByRole('radiogroup', { name: 'Where Support desk goes' });
    click(within(group).getByRole('radio', { name: 'Existing' }));
    expect(screen.getByText('Choose where SUP goes to continue.')).toBeDefined();
    const picker = await screen.findByRole('combobox', { name: 'Work project for Support desk' });
    click(picker);
    click(await screen.findByRole('option', { name: /Support Desk \(SUP\)/ }));
    expect(
      await screen.findByText('Its issues are numbered on from the last SUP key.', undefined, {
        timeout: 3000,
      }),
    ).toBeDefined();
    await enabled(reviewButton());
    click(reviewButton());
    const review = await screen.findByRole('region', { name: /Review/ });
    expect(review.textContent).toContain('SUP goes into Support Desk (SUP)');
  });

  it('sends what to bring and lists what is left out on Review', async () => {
    const update = vi.spyOn(importsApi, 'update');
    const key = await openOptions();
    const bring = screen.getByRole('region', { name: /What to bring/ });
    expect(within(bring).getByRole('checkbox', { name: /Issues/ })).toHaveProperty(
      'disabled',
      true,
    );
    click(within(bring).getByRole('checkbox', { name: /Links between issues/ }));
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith(expect.any(String), { include: { links: false } }),
    );
    typeIn(key, 'SUPD');
    await enabled(reviewButton());
    click(reviewButton());
    const review = await screen.findByRole('region', { name: /Review/ });
    const notBrought = within(review).getByText('Not brought');
    expect(notBrought.nextElementSibling?.textContent).toBe('Links between issues');
    expect(review.textContent).toContain('with comments, attachments and sprints and boards');
    expect(review.textContent).toContain('its report waits in Settings › Import');
    expect(review.textContent).not.toContain('Inbox');
  });

  it('sends a choice for a person and updates the numbers', async () => {
    const update = vi.spyOn(importsApi, 'update');
    await openOptions();
    const people = screen.getByRole('region', { name: /People/ });
    expect(people.textContent).toContain('86 found across the chosen projects');
    expect(people.textContent).not.toContain('Invite');
    click(within(people).getByRole('button', { name: 'Review all 86 people' }));
    const matched = await within(people).findAllByText('Matched');
    const row = matched[0]?.closest('li');
    if (!row) throw new Error('No matched person is listed');
    click(within(row).getByRole('combobox'));
    click(await screen.findByRole('option', { name: 'Placeholder' }));
    await waitFor(() =>
      expect(Object.values(update.mock.lastCall?.[1].people ?? {})).toEqual(['placeholder']),
    );
    await waitFor(() => expect(people.textContent).toContain('Become placeholders20'));
  });
});
