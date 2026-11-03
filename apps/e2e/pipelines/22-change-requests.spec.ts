import { readFileSync } from 'node:fs';
import { createSqlClient, type SqlClient } from '@bemmoly/core';
import { expect, test } from '@playwright/test';
import { expectLoaded, openPipelines } from '../support/pipelines.ts';
import { readState, statePath } from '../support/state.ts';

/*
 * A change request end to end: Staging gets an approval rule (one approval from a group the
 * member is in), the admin writes a request for a new checkout-api version and picks the
 * member, the member approves it, and the deploy starts by itself. A direct deploy to an
 * environment with a rule is refused. The group and the rule are written straight to the
 * tables, as Platform › Approval rules would, and taken away again at the end.
 */

const TARGET = 'staging';

function database(): SqlClient {
  const env = readFileSync(statePath('server.env'), 'utf8');
  const url = /^DATABASE_URL=(.*)$/m.exec(env)?.[1];
  if (!url) throw new Error('The e2e server env has no DATABASE_URL');
  return createSqlClient(url, { maxConnections: 2 });
}

test('ask for a change, approve it, and watch it deploy itself', async ({ browser }, info) => {
  const state = readState();
  const sql = database();
  const [group] = await sql<{ id: string }[]>`
    insert into pipeline_approval_groups (name) values ('Staging approvers') returning id`;
  if (!group) throw new Error('No group');
  await sql`insert into pipeline_approval_group_members (group_id, user_id)
    values (${group.id}, ${state.member.id})`;
  await sql`update pipeline_environments set versions_allowed = 'any',
    approval_rule = ${JSON.stringify({ steps: [{ group: group.id, count: 1, when: 'always' }] })}::jsonb
    where key = ${TARGET}`;
  const [release] = await sql<{ id: string }[]>`
    insert into pipeline_releases (application_id, version, commit_sha, test_summary, created_by)
    select id, 'cr-e2e-1', 'c0ffee1', '{"total": 4, "passed": 4, "failed": 0, "skipped": 0}'::jsonb,
      ${state.admin.id}
    from pipeline_applications where key = 'checkout-api'
    returning id`;
  if (!release) throw new Error('No release');
  try {
    const page = await openPipelines(
      browser,
      `/changes/new?environment=${TARGET}&application=checkout-api&release=${release.id}`,
    );
    const simulate = await page.request.put('/api/v1/admin/settings/pipelines.providers.simulate', {
      data: { value: true },
      headers: { origin: state.baseURL },
    });
    expect(simulate.ok()).toBe(true);

    // A direct deploy to an environment with a rule is sent to a change request.
    const direct = await page.request.post('/api/v1/pipelines/promotions', {
      data: { release: release.id, to: TARGET, mode: 'continuous' },
      headers: { origin: state.baseURL },
    });
    expect([400, 422]).toContain(direct.status());
    expect(await direct.text()).toContain('change request');

    // The form: Send stays off until the step has its approver.
    await expect(page.getByRole('heading', { name: 'New change request' })).toBeVisible();
    await page.getByLabel('Title', { exact: true }).fill('Retry failed checkouts');
    await page
      .getByLabel('Why', { exact: true })
      .fill('Fewer failed checkouts when payments are slow');
    const send = page.getByRole('button', { name: /Pick 1 more approver to send/ });
    await expect(send).toBeDisabled();
    await expect(page.getByRole('checkbox', { name: state.admin.name })).toHaveCount(0);
    await page.getByRole('checkbox', { name: state.member.name }).check();
    await page.screenshot({ path: info.outputPath('new-change.png'), fullPage: true });
    await page.getByRole('button', { name: /Send for approval/ }).click();

    await expect(page).toHaveURL(/\/pipelines\/changes\/CHG-\d+$/);
    const number = /CHG-\d+/.exec(page.url())?.[0] ?? '';
    await expect(page.getByText('0 of 1 approvals').first()).toBeVisible();
    await expect(page.getByText('Approval route')).toBeVisible();
    await expectLoaded(page);
    await page.screenshot({ path: info.outputPath('change-waiting.png'), fullPage: true });

    // On the Changes list with its count.
    await page.goto('/pipelines/changes');
    await expect(page.getByText(number)).toBeVisible();
    await expectLoaded(page);
    await page.screenshot({ path: info.outputPath('changes.png'), fullPage: true });

    // The member approves; the last approval starts the deploy by itself.
    const approver = await openPipelines(browser, `/changes/${number}`, state.member);
    await expect(approver.getByText(/You are the last approval this needs/)).toBeVisible();
    await approver.getByRole('button', { name: /^Approve/ }).click();
    await expect(approver.getByText(/Deploying now ·|Deployed by Promote/).first()).toBeVisible();
    await expectLoaded(approver);
    await approver.screenshot({
      path: info.outputPath('change-approved.png'),
      fullPage: true,
    });
    const [promotion] = await sql<{ n: number }[]>`
      select count(*)::int as n from pipeline_promotions p
      join pipeline_change_requests c on c.id = p.change_request_id
      where c.number = ${number.replace('CHG-', '')}::bigint`;
    expect(promotion?.n).toBe(1);
    await approver.context().close();
    await page.context().close();
  } finally {
    await sql`update pipeline_environments set approval_rule = null where key = ${TARGET}`;
    await sql.end({ timeout: 5 });
  }
});
