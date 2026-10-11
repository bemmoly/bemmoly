import { expect, test, uniqueKey } from '../support/fixtures.ts';

/*
 * Settings › Work: the org defaults every project inherits until it overrides them. Changing
 * the org default board reaches every project that follows it, so this runs alone (its own
 * project in the config), after the parallel flows, and puts the default back at the end.
 */

interface BoardRow {
  id: string;
  config: { quickFilters: { name: string; query: string }[] } & Record<string, unknown>;
}

const FILTER = 'Org triage';

test('an org admin changes the default board in Settings › Work and it reaches only projects that follow it', async ({
  page,
  admin,
  run,
  pageAs,
  apiFor,
}) => {
  const follows = await admin.createProject({ key: uniqueKey('FOL'), name: 'Follows the default' });
  const own = await admin.createProject({ key: uniqueKey('OWN'), name: 'Runs its own board' });
  for (const project of [follows, own]) {
    await admin.call('GET', `/work/projects/${project.key}/boards`);
  }
  await admin.call('POST', `/work/projects/${own.key}/schemes/board/override`);
  const [original] = (await admin.call<{ items: BoardRow[] }>('GET', '/work/boards')).items;
  if (!original) throw new Error('no org default board');

  try {
    // Settings › Modules lists Work as its own row, which opens the org defaults.
    await page.goto('/settings/workspace');
    await page.getByTestId('settings-module:work').click();
    await expect(page).toHaveURL(/\/settings\/work$/);
    await expect(page.getByRole('heading', { name: 'Issue types' })).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Views' })
      .getByRole('link', { name: 'Board', exact: true })
      .click();
    await expect(page).toHaveURL(/\/settings\/work\/board$/);
    await expect(page.getByTestId('org-default-usage')).toContainText(
      /Used by \d+ projects?; \d+ (has|have) (its|their) own version/,
    );

    await page.getByRole('radio', { name: 'Quick filters' }).click();
    await page.getByRole('button', { name: 'Edit Quick filters' }).click();
    await page.getByRole('button', { name: 'Add quick filter' }).click();
    const name = page.getByRole('textbox', { name: 'quick filter name' }).last();
    await name.fill(FILTER);
    await page.getByRole('combobox', { name: `${FILTER} query` }).fill('priority = Highest');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Review and save' }).click();
    const review = page.getByRole('dialog', { name: 'Review changes' });
    await expect(review).toContainText('every project that follows the default');
    await review.getByRole('button', { name: 'Save changes' }).click();
    await expect(review).toBeHidden();

    // The project that follows the default shows the new chip; the one with its own board not.
    const chip = (key: string) =>
      page
        .goto(`/work/board/${key}`)
        .then(() =>
          page.getByRole('group', { name: 'Quick filters' }).getByRole('button', { name: FILTER }),
        );
    await expect(await chip(follows.key)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Quick filters' })).toBeVisible();
    await expect(await chip(own.key)).toHaveCount(0);

    // The project's settings say where the board comes from and lead an admin back to it.
    await page.goto(`/work/settings/${follows.key}/board`);
    await expect(page.getByText(/Based on Workspace board, with no changes yet/)).toBeVisible();
    await page.getByRole('button', { name: 'Compare' }).click();
    const compare = page.getByRole('dialog', { name: 'Board settings overridden on this project' });
    await expect(compare).toContainText(/This board matches the org default/);
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: 'Edit org default' }).click();
    await expect(page).toHaveURL(/\/settings\/work\/board$/);

    // A member neither sees nor changes the org defaults.
    const memberPage = await pageAs(run.member);
    await memberPage.goto('/settings/work/board');
    await expect(
      memberPage.getByText('Only workspace admins can change Work settings'),
    ).toBeVisible();
    const member = await apiFor(run.member);
    const refused = await member.http.fetch(`/api/v1/work/boards/${original.id}`, {
      method: 'PATCH',
      data: { config: original.config },
    });
    expect(refused.status()).toBe(403);
  } finally {
    await admin.call('PATCH', `/work/boards/${original.id}`, { config: original.config });
  }
});
