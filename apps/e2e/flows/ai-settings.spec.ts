import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import {
  FAKE_KEY,
  startFakeModelServer,
  type FakeModelServer,
} from '../support/fake-model-server.ts';
import { expect, test } from '../support/fixtures.ts';

/*
 * Settings › AI against the real server and a model server the test starts on this machine:
 * an admin connects it as a Local server, tests it, gets the suggested models on every role,
 * changes one, sets a budget, and turns AI off, which folds the AI settings away. No provider
 * on the internet is called. Each screen passes axe on the way (WCAG 2.2 A and AA; colour
 * contrast is checked in the browser, as docs-a11y.spec.ts explains).
 */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoViolations(page: Page, screen: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG)
    .disableRules(['color-contrast'])
    .analyze();
  const found = violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  );
  expect(found, `${screen} has accessibility violations`).toEqual([]);
}

let fake: FakeModelServer;

test.beforeAll(async () => {
  fake = await startFakeModelServer();
});

test.afterAll(async () => {
  await fake.stop();
});

test('an admin connects a local server, assigns roles, sets a budget and turns AI off', async ({
  page,
}) => {
  await page.goto('/settings/ai');
  await expect(page.getByRole('heading', { name: 'AI and models' })).toBeVisible();
  // A fresh install: AI off, nothing connected, the first-time guidance.
  await expect(page.getByRole('heading', { name: 'AI is off' })).toBeVisible();
  await expectNoViolations(page, 'Settings › AI, never set up');

  await page.getByRole('button', { name: 'Add provider…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a provider' });
  await expect(dialog.getByRole('radiogroup', { name: 'Popular providers' })).toBeVisible();
  await expectNoViolations(page, 'the provider picker');
  await dialog.getByRole('radio', { name: /Local server/ }).click();

  const connect = page.getByRole('dialog', { name: 'Connect Local server' });
  await connect.getByLabel('Base URL').fill(fake.baseURL);
  await connect.getByLabel('API key').fill('not-the-key');
  await connect.getByRole('button', { name: 'Test connection' }).click();
  // The server's own refusal, in words, before anything is stored.
  await expect(connect.getByRole('alert')).toBeVisible();

  await connect.getByLabel('API key').fill(FAKE_KEY);
  await connect.getByRole('button', { name: 'Test connection' }).click();
  await expect(connect.getByRole('status')).toContainText('3 models found');
  await expectNoViolations(page, 'the connection form');
  await connect.getByRole('button', { name: 'Connect provider' }).click();
  await expect(connect).toBeHidden();

  // Connected, and every empty role took a suggested model from it.
  const providers = page.getByRole('table', { name: 'Connected providers' });
  await expect(providers.getByText('Local server', { exact: true })).toBeVisible();
  await expect(providers).toContainText('Connected');
  for (const role of ['fast', 'standard', 'strong']) {
    await expect(page.getByRole('combobox', { name: `Model for the ${role} role` })).toContainText(
      'house-chat',
    );
  }
  await expect(page.getByRole('combobox', { name: 'Model for the embedding role' })).toContainText(
    'house-embed',
  );

  await page.getByRole('combobox', { name: 'Model for the strong role' }).click();
  await page.getByRole('option', { name: /house-chat-large/ }).click();
  await expect(page.getByRole('combobox', { name: 'Model for the strong role' })).toContainText(
    'house-chat-large',
  );
  await expectNoViolations(page, 'Settings › AI with a provider');

  await page.getByRole('link', { name: 'Usage' }).click();
  await page.getByRole('button', { name: 'Edit Monthly budget' }).click();
  await page.getByLabel('Limit in US dollars').fill('25');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('$25.00', { exact: true })).toBeVisible();
  await expectNoViolations(page, 'Settings › AI › Usage');

  await page.getByRole('link', { name: 'Prompts' }).click();
  await expect(page.getByRole('table', { name: 'Prompts' })).toBeVisible();
  await expectNoViolations(page, 'Settings › AI › Prompts');

  await page.getByRole('link', { name: 'Privacy' }).click();
  await expect(page.getByRole('switch', { name: 'Hide email addresses' })).toBeVisible();
  await expectNoViolations(page, 'Settings › AI › Privacy');

  // Off: the sections fold away, the providers are kept, and /me says AI is off.
  await page.getByRole('link', { name: 'Setup' }).click();
  await page.getByRole('switch', { name: 'AI for this workspace' }).click();
  await expect(page.getByRole('switch', { name: 'AI for this workspace' })).not.toBeChecked();
  await expect(page.getByRole('link', { name: 'Usage' })).toBeHidden();
  await expect(page.getByRole('table', { name: 'Connected providers' })).toBeHidden();
  await expect(page.getByText(/Providers and roles are kept/)).toBeVisible();
  const me = await page.request.get('/api/v1/me');
  expect(((await me.json()) as { workspace: { aiEnabled: boolean } }).workspace.aiEnabled).toBe(
    false,
  );
  expect(fake.requests).toContain('GET /v1/models');
});
