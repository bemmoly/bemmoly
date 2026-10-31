import { AxeBuilder } from '@axe-core/playwright';
import { mailedLink, newPerson, signedOutPage } from '../support/auth.ts';
import { expect, test } from '../support/fixtures.ts';

/**
 * The sign-in pages against a real server: honest errors, the remembered person after a
 * sign-out, and a password reset that signs in when it is saved.
 */
test.describe('sign-in', () => {
  test('the sign-in pages pass axe, contrast included, in light and dark', async ({
    browser,
    run,
  }) => {
    for (const colorScheme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        baseURL: run.baseURL,
        colorScheme,
        storageState: { cookies: [], origins: [] },
      });
      const page = await context.newPage();
      for (const path of ['/login', '/forgot-password', '/login?reason=expired']) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        // The product panel is an illustration hidden from assistive tech; the form is the page.
        const { violations } = await new AxeBuilder({ page })
          .exclude('aside[aria-hidden="true"]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(
          violations.map(
            (v) =>
              `${path} ${colorScheme}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
          ),
        ).toEqual([]);
      }
      await context.close();
    }
  });

  test('a wrong password is a field error with the password selected', async ({
    admin,
    browser,
    run,
  }) => {
    const person = await newPerson(admin, run.baseURL, 'typo');
    const page = await signedOutPage(browser, run.baseURL);
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in to Acme Labs' })).toBeVisible();
    await page.getByLabel('Email', { exact: true }).fill(person.email);
    await page.getByLabel('Password', { exact: true }).fill('not my password');
    await page.keyboard.press('Enter');
    const password = page.getByLabel('Password', { exact: true });
    await expect(password).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('alert')).toContainText('That email and password don’t match');
    await expect(password).toBeFocused();
    const selected = await password.evaluate(
      (input: HTMLInputElement) => input.selectionEnd! - input.selectionStart!,
    );
    expect(selected).toBe('not my password'.length);

    await password.fill(person.password);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: 'Signed in' })).toBeVisible();
    await page.waitForURL((url) => url.pathname === '/start');
    await page.context().close();
  });

  test('a deactivated account says who can turn it back on', async ({ admin, browser, run }) => {
    const person = await newPerson(admin, run.baseURL, 'former');
    await admin.call('POST', `/users/${person.id}/deactivate`);
    const page = await signedOutPage(browser, run.baseURL);
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill(person.email);
    await page.getByLabel('Password', { exact: true }).fill(person.password);
    await page.keyboard.press('Enter');
    await expect(page.getByText('Your Acme Labs account is turned off')).toBeVisible();
    await expect(page.getByText(/Settings › People/)).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
    await page.context().close();
  });

  test('after signing out, the page names the reason and remembers the person', async ({
    admin,
    browser,
    run,
  }) => {
    const person = await newPerson(admin, run.baseURL, 'returning');
    const page = await signedOutPage(browser, run.baseURL);
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill(person.email);
    await page.getByLabel('Password', { exact: true }).fill(person.password);
    await page.keyboard.press('Enter');
    await page.waitForURL((url) => url.pathname === '/start');
    await page.goto('/login?reason=signed-out');
    // Still signed in: the sign-in page sends them on. Sign out for real.
    await page.waitForURL((url) => url.pathname === '/');
    await page.evaluate(() =>
      fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );
    await page.goto('/login?reason=signed-out');
    await expect(page.getByText('You’re signed out')).toBeVisible();
    await expect(page.getByText(person.name)).toBeVisible();
    await expect(page.getByLabel('Email', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Not you?' }).click();
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await page.context().close();
  });

  test('a password reset names the account and signs in when saved', async ({
    admin,
    browser,
    run,
  }) => {
    const person = await newPerson(admin, run.baseURL, 'forgetful');
    const page = await signedOutPage(browser, run.baseURL);
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill(person.email);
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    // The address comes along from the sign-in form.
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue(person.email);
    await page.getByRole('button', { name: 'Email me a link' }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resend link' })).toBeDisabled();

    const link = await mailedLink(admin, person.email, /\S*\/reset-password#token=[\w-]+/);
    await page.goto(new URL(link, run.baseURL).pathname + new URL(link, run.baseURL).hash);
    await expect(page.getByText(`For ${person.email}.`)).toBeVisible();
    await page.getByLabel('New password').fill('a brand new long passphrase');
    await expect(page.getByText(/Strength:/)).toBeVisible();
    await page.getByRole('button', { name: 'Save password and sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Forgetful');
    await page.context().close();
  });
});
