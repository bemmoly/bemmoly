import { githubDelivery } from '@bemmoly/core/testing';
import { expect, test, uniqueKey } from '../support/fixtures.ts';

/*
 * A connected GitHub host, a signed pull request delivery from the hand-written fixtures sent
 * to the webhook as GitHub would (no session), and the Development section on the issue page
 * drawing it. Nothing reaches a real code host: the host's API is never called here.
 */

const SECRET = 'e2e-webhook-secret-0123456789';

test('the issue page shows a pull request linked by a signed delivery', async ({
  page,
  admin,
  playwright,
  run,
}) => {
  const project = await admin.createProject({ key: uniqueKey('DEV'), name: 'Code links' });
  const [issue] = await admin.createIssues(project, ['Session store to Postgres']);
  if (!issue) throw new Error('no issue');

  const host = await admin.call<{ id: string }>('POST', '/admin/code-hosts', {
    kind: 'github',
    name: 'E2E GitHub',
    webhookSecret: SECRET,
    credentials: { mode: 'token', token: 'e2e-token-never-sent-anywhere' },
  });

  // Empty first: the section always shows and says how to link code.
  await page.goto(`/work/issue/${issue.key}`);
  const development = page.getByRole('region', { name: 'Development' });
  await expect(development).toContainText(`Name ${issue.key} in a branch, pull request or commit`);

  const hook = await playwright.request.newContext({ baseURL: run.baseURL });
  const delivery = githubDelivery('pull_request.opened', SECRET, {
    replace: { 'ACME-1': issue.key },
  });
  const sent = await hook.post(`/api/v1/code-hosts/${host.id}/webhooks`, {
    headers: delivery.headers,
    data: delivery.body,
  });
  expect(sent.status()).toBe(200);
  expect(await sent.json()).toEqual({ outcome: 'processed' });

  const forged = githubDelivery('pull_request.merged', 'not-the-secret-at-all', {
    replace: { 'ACME-1': issue.key },
  });
  const refused = await hook.post(`/api/v1/code-hosts/${host.id}/webhooks`, {
    headers: forged.headers,
    data: forged.body,
  });
  expect(refused.status()).toBe(401);
  await hook.dispose();

  // The delivery publishes an invalidation, so the open page updates without a reload.
  const pull = development.getByRole('link', { name: /#4821 Session store to Postgres/ });
  await expect(pull).toBeVisible();
  await expect(pull).toContainText('Open');
  await expect(pull).toHaveAttribute('href', 'https://github.com/acme/api/pull/4821');
  await expect(development).toContainText('1 open');

  await admin.call('DELETE', `/admin/code-hosts/${host.id}`);
});
