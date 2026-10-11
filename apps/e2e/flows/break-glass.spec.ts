import { startFakeOidcProvider, type FakeOidcProvider } from '@bemmoly/core/testing';
import type { Page } from '@playwright/test';
import { expect, test } from '../support/fixtures.ts';
import type { Person } from '../support/state.ts';

/**
 * Settings › Sign-in and SSO: an org admin marks another admin as break-glass, the confirmation
 * names them, the other admins are told, and while single sign-on is required the last one
 * cannot be removed. Requiring SSO changes every sign-in page, so this file runs alone.
 */
test.describe.configure({ mode: 'serial' });

test.describe('break-glass admins', () => {
  let fake: FakeOidcProvider;
  let providerId = '';
  test.beforeAll(async () => {
    fake = await startFakeOidcProvider();
  });
  test.afterAll(async () => fake.stop());

  /** Another org admin than the one this worker signs in as, and not the first admin. */
  const colleagueOf = (admins: Person[], me: Person, first: Person) =>
    admins.find((person) => person.id !== me.id && person.id !== first.id)!;

  const rowOf = (page: Page, name: string) =>
    page.getByRole('list', { name: 'Org admins' }).getByRole('listitem').filter({ hasText: name });

  test('an admin marks a colleague, naming them, and the other admins are told', async ({
    page,
    me,
    run,
    apiFor,
  }) => {
    const colleague = colleagueOf(run.admins, me, run.admin);
    await page.goto('/settings/authentication');
    const row = rowOf(page, colleague.name);
    await expect(row.getByText('Break-glass', { exact: true })).toHaveCount(0);
    await row.getByRole('button', { name: /^Make break-glass/ }).click();
    const dialog = page.getByRole('dialog', {
      name: `Make ${colleague.name} a break-glass admin?`,
    });
    await expect(
      dialog.getByText('Every other org admin is told about this change.'),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Make break-glass admin' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(row.getByText('Break-glass', { exact: true })).toBeVisible();
    await expect(page.getByText(`${colleague.name} is now a break-glass admin`)).toBeVisible();

    const theirs = await apiFor(colleague);
    await expect
      .poll(async () => {
        const { items } = await theirs.call<{ items: { kind: string }[] }>('GET', '/notifications');
        return items.some((item) => item.kind === 'break_glass_changed');
      })
      .toBe(true);
  });

  test('while single sign-on is required the last one stays', async ({ page, me, run, admin }) => {
    const colleague = colleagueOf(run.admins, me, run.admin);
    fake.user = { sub: 'sub-bg', email: run.admin.email, emailVerified: true, name: 'Rohan S.' };
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
    const started = await page.request.post(`/api/v1/admin/sso/providers/${providerId}/tests`, {
      headers: { origin: run.baseURL },
    });
    const { authorizationUrl } = (await started.json()) as { authorizationUrl: string };
    await page.goto(authorizationUrl);
    await page.waitForURL((url) => url.origin === run.baseURL);
    await admin.call('PUT', '/admin/sso/policy', { requireSso: true });
    const others = run.admins.filter((person) => person.id !== colleague.id);
    try {
      // Only the colleague keeps a password: everyone else is unmarked through the API.
      for (const person of others) {
        await admin.call('DELETE', `/admin/sso/break-glass-admins/${person.id}`);
      }
      await page.goto('/settings/authentication');
      const row = rowOf(page, colleague.name);
      const remove = row.getByRole('button', { name: /^Remove/ });
      await expect(remove).toBeDisabled();
      await expect(
        row.getByText('The last break-glass admin stays while single sign-on is required.'),
      ).toBeVisible();

      // With someone else marked, the colleague can go, after a confirmation naming them.
      const first = rowOf(page, run.admin.name);
      await first.getByRole('button', { name: /^Make break-glass/ }).click();
      await page.getByRole('button', { name: 'Make break-glass admin' }).click();
      await expect(remove).toBeEnabled();
      await remove.click();
      const dialog = page.getByRole('dialog', {
        name: `Remove ${colleague.name} as a break-glass admin?`,
      });
      await expect(dialog.getByText(/can no longer sign in with a password/)).toBeVisible();
      await dialog.getByRole('button', { name: 'Remove break-glass admin' }).click();
      await expect(row.getByText('Break-glass', { exact: true })).toHaveCount(0);
      await expect(first.getByRole('button', { name: /^Remove/ })).toBeDisabled();
    } finally {
      await admin.call('PUT', '/admin/sso/policy', { requireSso: false });
      await admin.call('PUT', `/admin/sso/break-glass-admins/${run.admin.id}`);
      if (providerId) await admin.call('DELETE', `/admin/sso/providers/${providerId}`);
    }
  });
});
