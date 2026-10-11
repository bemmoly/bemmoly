import { startFakeOidcProvider, type FakeOidcProvider } from '@bemmoly/core/testing';
import { signedOutPage } from '../support/auth.ts';
import { expect, test } from '../support/fixtures.ts';

/**
 * Sign-in under install-wide settings: single sign-on first, required with the admin password
 * fallback, the remembered method, and an admin skipping the setup wizard. Each changes what
 * every sign-in page shows, so this file runs alone after the other flows.
 */
test.describe.configure({ mode: 'serial' });

test.describe('sign-in policy', () => {
  let fake: FakeOidcProvider;
  let providerId = '';
  test.beforeAll(async () => {
    fake = await startFakeOidcProvider();
  });
  test.afterAll(async () => fake.stop());

  test('single sign-on comes first and the device remembers it', async ({
    admin,
    browser,
    run,
  }) => {
    const email = `grace.${Date.now()}@acmelabs.dev`;
    fake.user = { sub: `sub-${email}`, email, emailVerified: true, name: 'Grace Hopper' };
    const provider = await admin.call<{ id: string }>('POST', '/admin/sso/providers', {
      displayName: 'Acme SSO',
      config: {
        protocol: 'oidc',
        issuerUrl: fake.issuer,
        clientId: fake.clientId,
        clientSecret: fake.clientSecret,
      },
    });
    providerId = provider.id;
    const page = await signedOutPage(browser, run.baseURL);
    await page.goto('/login');
    const button = page.getByRole('button', { name: 'Continue with Acme SSO' });
    await expect(button).toBeVisible();
    await expect(page.getByText('or with email')).toBeVisible();
    await expect(page.getByLabel('Email', { exact: true })).not.toBeFocused();
    await button.click();
    await page.waitForURL((url) => url.pathname === '/');

    await page.context().clearCookies();
    await page.goto('/login');
    const remembered = page.getByRole('button', { name: /Continue with Acme SSO/ });
    await expect(remembered).toContainText('Last used');
    await expect(remembered).toBeFocused();
    await page.context().close();
  });

  test('when single sign-on is required, admins keep a plain password fallback', async ({
    admin,
    browser,
    page: adminPage,
    run,
  }) => {
    // Requiring single sign-on needs one successful test sign-in, as Settings asks for.
    const started = await adminPage.request.post(
      `/api/v1/admin/sso/providers/${providerId}/tests`,
      {
        headers: { origin: run.baseURL },
      },
    );
    expect(started.status()).toBe(201);
    const { authorizationUrl } = (await started.json()) as { authorizationUrl: string };
    await adminPage.goto(authorizationUrl);
    await adminPage.waitForURL((url) => url.origin === run.baseURL);
    await admin.call('PUT', '/admin/sso/policy', { requireSso: true });
    try {
      const page = await signedOutPage(browser, run.baseURL);
      await page.goto('/login');
      await expect(page.getByText('Acme Labs signs everyone in through Acme SSO.')).toBeVisible();
      await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Use a password' }).click();
      await expect(page).toHaveURL(/method=password/);
      await expect(page.getByRole('heading', { name: 'Admin sign-in' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Forgot password?' })).toHaveCount(0);
      await page.getByLabel('Email', { exact: true }).fill(run.admin.email);
      await page.getByLabel('Password', { exact: true }).fill(run.admin.password);
      await page.getByRole('button', { name: 'Sign in with password' }).click();
      await page.waitForURL((url) => url.pathname === '/');
      await page.context().close();
    } finally {
      await admin.call('PUT', '/admin/sso/policy', { requireSso: false });
      if (providerId) await admin.call('DELETE', `/admin/sso/providers/${providerId}`);
    }
  });

  test('an admin can skip an unfinished setup and finish it from Home', async ({
    admin,
    browser,
    run,
  }) => {
    const finished = await admin.call<{ value: string | null }>(
      'GET',
      '/admin/settings/setup.completedAt',
    );
    await admin.call('PUT', '/admin/settings/setup.completedAt', { value: null });
    try {
      const page = await signedOutPage(browser, run.baseURL);
      await page.goto('/login');
      await page.getByLabel('Email', { exact: true }).fill(run.admin.email);
      await page.getByLabel('Password', { exact: true }).fill(run.admin.password);
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Continue' })).toBeFocused();
      await page.getByRole('button', { name: 'Skip setup and open Acme Labs' }).click();
      await page.waitForURL((url) => url.pathname === '/');
      await expect(page.getByRole('heading', { name: 'Finish setting up' })).toBeVisible();
      await page.getByRole('link', { name: 'Continue setup' }).click();
      await expect(page).toHaveURL(/\/setup\?step=3/);
      await page.context().close();
    } finally {
      await admin.call('PUT', '/admin/settings/setup.completedAt', {
        value: finished.value ?? new Date().toISOString(),
      });
    }
  });
});
