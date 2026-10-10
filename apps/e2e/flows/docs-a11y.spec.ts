import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { arrangePage, body, openLive } from '../support/docs.ts';
import { expect, test, uniqueKey } from '../support/fixtures.ts';

/*
 * Every Docs screen through axe, against WCAG 2.2 A and AA, in both themes. Colour contrast
 * is left out on purpose: the theme's quieter text tokens (tx4 and tx5, the mocks' #6b7483
 * and #8a93a3) are under 4.5:1 on the grey surfaces in every screen of the app, and the
 * theme is settled until its own accessibility pass. Everything else must be clean.
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

/** A body with a heading, a link to another page and a list, so the prose rules have work. */
const bodyWithLink = (pageId: string) => ({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Context' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Sessions move to Postgres; see the ' },
        {
          type: 'text',
          text: 'runbook',
          marks: [{ type: 'link', attrs: { href: `/docs/p/${pageId}` } }],
        },
        { type: 'text', text: ' first.' },
      ],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Dual-write' }] }],
        },
      ],
    },
  ],
});

for (const theme of ['light', 'dark'] as const) {
  test(`every Docs screen passes axe in the ${theme} theme`, async ({ page, admin }) => {
    await page.addInitScript((mode) => {
      localStorage.setItem(
        'bemmoly.theme',
        JSON.stringify({ state: { mode, preset: null }, version: 2 }),
      );
    }, theme);
    const runbook = await arrangePage(admin, uniqueKey('A'), 'Runbook');
    const space = await admin.call<{ id: string }>('GET', `/docs/spaces/${runbook.spaceKey}`);
    const rfc = await admin.call<{ id: string }>('POST', '/docs/pages', {
      spaceId: space.id,
      title: 'Session store RFC',
      snapshot: bodyWithLink(runbook.id),
    });

    await page.goto('/docs');
    await expect(page.getByRole('heading', { name: 'Docs', level: 1 })).toBeVisible();
    await expectNoViolations(page, 'Docs home');

    await page.goto(`/docs/s/${runbook.spaceKey}`);
    await expect(page.getByRole('tree')).toBeVisible();
    await expectNoViolations(page, 'space overview');

    await page.goto(`/docs/s/${runbook.spaceKey}/trash`);
    await expect(page.getByRole('heading', { name: 'Trash', level: 1 })).toBeVisible();
    await expectNoViolations(page, 'trash');

    await page.goto('/docs/create');
    await expect(page.getByRole('dialog', { name: 'New page' })).toBeVisible();
    await expectNoViolations(page, 'template picker');

    await page.goto('/docs/spaces/new');
    await expect(page.getByRole('dialog', { name: 'Create space' })).toBeVisible();
    await expectNoViolations(page, 'create space');

    await openLive(page, rfc.id);
    await expect(body(page).getByRole('link', { name: 'runbook' })).toBeVisible();
    await expectNoViolations(page, 'page editor');

    for (const margin of ['Comments', 'Linked work']) {
      await page.getByRole('button', { name: margin, exact: true }).click();
      await expect(page.getByRole('complementary', { name: margin })).toBeVisible();
      await expectNoViolations(page, `margin ${margin}`);
    }
    await page.getByRole('button', { name: 'Version history' }).click();
    await expect(page.getByRole('complementary', { name: 'Versions' })).toBeVisible();
    await expectNoViolations(page, 'version history');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Share' }).click();
    await expect(page.getByRole('dialog', { name: 'Share' })).toBeVisible();
    await expectNoViolations(page, 'share');

    await page.goto('/docs/p/01a00000-0000-7000-8000-000000000000');
    await expect(
      page.getByRole('heading', { name: 'This page does not exist', level: 1 }),
    ).toBeVisible();
    await expectNoViolations(page, 'missing page');
  });
}
