import { startFakeOidcProvider, type FakeOidcProvider } from '@bemmoly/core/testing';
import { expect, test } from '../support/fixtures.ts';

/**
 * Single sign-on end to end: an admin adds an OpenID Connect provider (a fake one on this
 * machine), and someone new signs in through "Continue with Acme sign-in" in a signed-out browser, is
 * provisioned on the way, and lands where they were going.
 */
test.describe('single sign-on', () => {
  let fake: FakeOidcProvider;
  test.beforeAll(async () => {
    fake = await startFakeOidcProvider();
  });
  test.afterAll(async () => fake.stop());

  test('a new person signs in through the identity provider', async ({ admin, browser, run }) => {
    const email = `grace.${Date.now()}@acmelabs.dev`;
    fake.user = { sub: `sub-${email}`, email, emailVerified: true, name: 'Grace Hopper' };
    const provider = await admin.call<{ id: string }>('POST', '/admin/sso/providers', {
      displayName: 'Acme sign-in',
      config: {
        protocol: 'oidc',
        issuerUrl: fake.issuer,
        clientId: fake.clientId,
        clientSecret: fake.clientSecret,
      },
    });
    try {
      // Signed out: nobody's session, whatever the project's default storage state is.
      const context = await browser.newContext({
        baseURL: run.baseURL,
        storageState: { cookies: [], origins: [] },
      });
      const page = await context.newPage();
      await page.goto('/login?redirect=%2Fsettings%2Fprofile');
      await page.getByRole('button', { name: 'Continue with Acme sign-in' }).click();
      await page.waitForURL(/\/settings\/profile/);
      await expect(page.getByText(email).first()).toBeVisible();
      const request = fake.authorizations.at(-1);
      expect(request?.get('code_challenge_method')).toBe('S256');

      await page.context().clearCookies();
      fake.tamper = { audience: 'someone-else' };
      await page.goto('/login');
      await page.getByRole('button', { name: 'Continue with Acme sign-in' }).click();
      await expect(page.getByRole('alert')).toContainText('did not verify');
      await expect(page.getByRole('alert')).toContainText('Acme sign-in didn’t sign you in');
      await context.close();
    } finally {
      fake.tamper = {};
      await admin.call('DELETE', `/admin/sso/providers/${provider.id}`);
    }
  });
});
