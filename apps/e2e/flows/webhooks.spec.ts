import { expect, test } from '../support/fixtures.ts';

/*
 * Settings › Webhooks against the real server. The install does not allow private URLs, so a
 * loopback target is refused when saved; a documentation-range address saves, and its test
 * send ends in a timeout the page reports honestly.
 */
test('an admin adds a webhook, keeps its secret and sees a test send fail', async ({
  page,
  admin,
}) => {
  test.setTimeout(90_000);
  await page.goto('/settings/webhooks');
  await page.getByRole('button', { name: 'New webhook' }).first().click();
  const form = page.getByRole('dialog');
  await form.getByRole('textbox', { name: 'Name' }).fill('Release notes bot');
  await form.getByRole('textbox', { name: 'URL' }).fill('http://127.0.0.1:9/hooks');
  // A rare event, so few of the other flows' changes queue deliveries to this address.
  await form.getByRole('checkbox', { name: 'Sprint completed' }).check();
  await form.getByRole('button', { name: 'Create webhook' }).click();
  await expect(form.getByText(/private address 127\.0\.0\.1/)).toBeVisible();

  await form.getByRole('textbox', { name: 'URL' }).fill('https://192.0.2.10/hooks');
  await form.getByRole('button', { name: 'Create webhook' }).click();
  await expect(form.getByText(/^whsec_[\w-]{43}$/)).toBeVisible();
  await expect(form.getByText('It won’t be shown again', { exact: false })).toBeVisible();
  await form.getByRole('button', { name: 'Open webhook' }).click();

  await expect(page.getByRole('heading', { name: 'Release notes bot' })).toBeVisible();
  await page.getByRole('button', { name: 'Send test' }).first().click();
  const result = page.getByRole('status').filter({ hasText: 'No answer' });
  await expect(result).toBeVisible({ timeout: 30_000 });
  // Other flows may complete a sprint meanwhile; the test send is the one row to look for.
  const deliveries = page.getByRole('table', { name: 'Deliveries' });
  await expect(deliveries.getByRole('row', { name: /Test send/ })).toHaveCount(1);

  const id = new URL(page.url()).pathname.split('/').at(-1);
  await admin.call('DELETE', `/admin/webhooks/${id}`);
});
