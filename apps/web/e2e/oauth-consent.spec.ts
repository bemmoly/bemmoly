import { expect, test } from '@playwright/test';
import { MOCK_PASSWORD } from '../src/mocks/db.ts';
import { useMockBackend } from './support/mock-backend.ts';

/*
 * The consent screen an MCP client opens: a stranger signs in first and comes back to the same
 * request, chooses less than the app asked for, and is sent back to the app with a code.
 */

const CALLBACK = 'http://localhost:7123/callback';
const REQUEST = {
  response_type: 'code',
  client_id: 'https://desk.example/oauth/client.json',
  redirect_uri: CALLBACK,
  code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  code_challenge_method: 'S256',
  scope: 'mcp:read mcp:write',
  state: '4711',
};
const authorizePath = `/oauth/authorize?${new URLSearchParams(REQUEST).toString()}`;

test('a signed-out person signs in, chooses read only, and goes back to the app', async ({
  page,
}) => {
  const backend = await useMockBackend(page, 'signed-out');
  backend.api.db.settings['mcp.enabled'] = true;
  // The app listening on this computer: answer its callback instead of leaving the test.
  let landed: URL | null = null;
  await page.route(`${CALLBACK}**`, async (route) => {
    landed = new URL(route.request().url());
    await route.fulfill({ contentType: 'text/html', body: '<p>Connected</p>' });
  });

  await page.goto(authorizePath);
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await page.getByLabel('Email').fill('rohan@acmelabs.dev');
  await page.getByLabel('Password', { exact: true }).fill(MOCK_PASSWORD);
  await page.getByRole('button', { name: /^Sign in/ }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Connect Desk Assistant' }),
  ).toBeVisible();
  await expect(page).toHaveTitle(/Connect Desk Assistant/);
  const card = page.getByRole('region', { name: 'The app asking for access' });
  await expect(card.getByText('desk.example')).toBeVisible();
  await expect(card.getByText('localhost:7123')).toBeVisible();
  await expect(page.getByText('This app runs on your computer')).toBeVisible();

  await page.getByRole('radio', { name: /Read only/ }).check();
  await page.getByRole('checkbox', { name: 'Docs' }).uncheck();
  await page.getByRole('button', { name: 'Connect Desk Assistant' }).click();
  await expect(page.getByText('Connected')).toBeVisible();
  expect(landed).not.toBeNull();
  const back = landed as unknown as URL;
  expect(back.searchParams.get('state')).toBe('4711');
  expect(back.searchParams.get('code')).toMatch(/^mock-/);
  expect(backend.api.db.oauthGrants?.[0]).toMatchObject({ access: 'read' });
  expect(backend.api.db.oauthGrants?.[0]?.modules).not.toContain('docs');
});

test('an address the app never registered is refused on the page', async ({ page }) => {
  const backend = await useMockBackend(page, 'ready');
  backend.api.db.settings['mcp.enabled'] = true;
  const evil = { ...REQUEST, redirect_uri: 'https://evil.example/callback' };
  await page.goto(`/oauth/authorize?${new URLSearchParams(evil).toString()}`);
  await expect(page.getByText('This connection can’t continue')).toBeVisible();
  await expect(page.getByRole('button', { name: /Connect|Back to/ })).toHaveCount(0);
  await expect(page).toHaveURL(/\/oauth\/authorize/);
});
