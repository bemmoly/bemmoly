import { expect, test, type Page } from '@playwright/test';
import { RFC_PAGE_ID } from '../../src/mocks/seed/ai-insights.ts';
import { useMockBackend } from '../support/mock-backend.ts';
import { A11Y_THEME } from './a11y.config.ts';
import { closeCollab } from './screens.ts';

/*
 * What axe cannot see (docs/accessibility-conformance.md): the main flows with the keyboard
 * alone, where focus goes and comes back, and the single-pointer ways to do what a drag does.
 */

/** The element that has focus, by its role and accessible name, for readable failures. */
async function focused(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return 'body';
    const name = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 60) ?? '';
    return `${el.getAttribute('role') ?? el.tagName.toLowerCase()} "${name}"`;
  });
}

// Colour plays no part here, so CI runs these once, on the Bemmoly theme's runner.
test.skip(A11Y_THEME !== undefined && A11Y_THEME !== 'bemmoly', 'theme-independent');

test.beforeEach(async ({ page }) => {
  await closeCollab(page);
});

test('the skip link is the first stop and lands on the page, past the sidebar', async ({
  page,
}) => {
  await useMockBackend(page, 'ready');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /, Rohan$/ })).toBeVisible();
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  // The next Tab is inside the page, not back in the sidebar.
  await page.keyboard.press('Tab');
  const inMain = await page.evaluate(() => Boolean(document.activeElement?.closest('main')));
  expect(inMain, `Tab after the skip link went to ${await focused(page)}`).toBe(true);
});

test('every signed-in screen has one main, a named sidebar and an h1 first', async ({ page }) => {
  await useMockBackend(page, 'ready');
  for (const path of ['/', '/inbox', '/work/board/PLT', '/work/backlog/PLT', '/docs/s/ENG']) {
    await page.goto(path);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('complementary', { name: 'Sidebar' })).toBeAttached();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeAttached();
  }
});

test('create an issue with the keyboard alone; focus returns to where it was', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/work/board/PLT');
  await expect(page).toHaveTitle(/^Board · /);
  await page.keyboard.press('c');
  const form = page.getByRole('dialog', { name: 'Create issue' });
  await expect(form).toBeVisible();
  await expect(form.getByRole('textbox', { name: 'Title' })).toBeFocused();
  await page.keyboard.type('Keyboard-only issue');
  // Back to the type (past Close), and a Task, which needs nothing more.
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(form.getByRole('combobox', { name: 'Issue type' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('option', { name: 'Task' })).toBeVisible();
  await page.keyboard.type('Task');
  await page.keyboard.press('Enter');
  const type = form.getByRole('combobox', { name: 'Issue type' });
  await expect(type).toContainText('Task');
  await expect(type).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(form.getByRole('textbox', { name: 'Title' })).toBeFocused();
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(form).toBeHidden();
  // The toast says what happened, in a live region.
  await expect(page.getByRole('status').filter({ hasText: /PLT-\d+/ })).toBeVisible();
});

test('a board card moves with the keyboard, and the move is read out', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/work/board/PLT');
  const card = page.locator('[data-issue-key="PLT-204"]');
  const column = () =>
    page
      .locator('[data-issue-key="PLT-204"]')
      .evaluate((el) => el.closest('[role="group"]')?.getAttribute('aria-label') ?? null);
  await card.focus();
  const before = await column();
  expect(before).not.toBeNull();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await expect.poll(column).not.toBe(before);
  await expect(page.locator('[aria-live="assertive"]')).toContainText(/PLT-204/);
  await expect(page.locator('[data-issue-key="PLT-204"]')).toBeFocused();
});

test('a board card changes column with single clicks, no drag', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/work/board/PLT?issue=PLT-204');
  const peek = page.getByRole('complementary', { name: 'PLT-204 details' });
  await expect(peek).toBeVisible();
  const status = peek.getByRole('button', { name: /^Status: .*Change status$/ });
  const was = await status.getAttribute('aria-label');
  await status.click();
  await page.getByRole('menuitem', { name: /^Approve/ }).click();
  await expect(status).not.toHaveAttribute('aria-label', was ?? '');
});

test('a backlog row moves with the keyboard and by its menu', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/work/backlog/PLT');
  const row = page.locator('[data-issue-key="PLT-222"]').first();
  await row.focus();
  const said = page.locator('[aria-live="polite"]').filter({ hasText: /PLT-222/ });
  await page.keyboard.press('Space');
  await expect(said).toContainText('Picked up PLT-222');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await expect(said).toContainText('Dropped PLT-222');
  // Single pointer: the row's menu moves it, no drag.
  await row.hover();
  await page.getByRole('button', { name: 'Actions for PLT-222' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menu').getByRole('group', { name: 'Move to' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Actions for PLT-222' })).toBeFocused();
});

test('the page tree is a tree, and a page moves with Alt+arrows or the Move dialog', async ({
  page,
}) => {
  await useMockBackend(page, 'ready');
  await page.goto('/docs/s/ENG');
  const tree = page.getByRole('tree').first();
  await expect(tree).toBeVisible();
  const items = tree.getByRole('treeitem');
  expect(await items.count()).toBeGreaterThan(1);
  await expect(items.first()).toHaveAttribute('aria-level', '1');
  for (const item of await items.all()) await expect(item).toHaveAccessibleName(/\S/);

  // Single pointer: the page's More menu moves it, no drag.
  await page.goto(`/docs/p/${RFC_PAGE_ID}`);
  const more = page.getByRole('button', { name: 'More actions' });
  await more.click();
  await page.getByRole('menuitem', { name: /^Move to…/ }).click();
  await expect(page.getByRole('dialog', { name: /Move/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(more).toBeFocused();
});

test('the roadmap names every bar and its dates change without dragging', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/work/roadmap/PLT');
  const bar = page.locator('[aria-label*="% done"]').first();
  await expect(bar).toBeVisible();
  await bar.focus();
  await expect(bar).toBeFocused();
  await expect(bar).toHaveAccessibleName(/% done/);
});

test('write in a doc and the save state is read out', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto(`/docs/p/${RFC_PAGE_ID}`);
  const editor = page.locator('[contenteditable="true"]').filter({ hasText: 'moving session' });
  await editor.getByRole('heading', { name: 'Context' }).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Typed with the keyboard.');
  const save = page.locator('[role="status"].sr-only');
  await expect(save.first()).not.toBeEmpty();

  // Select the line and comment from the bubble's toolbar, keyboard only.
  await page.keyboard.press('Shift+Home');
  const toolbar = page.getByRole('toolbar');
  await expect(toolbar).toBeVisible();
  const comment = toolbar.getByRole('button', { name: 'Comment' });
  await expect(comment).toBeVisible();
  for (const button of await toolbar.getByRole('button').all()) {
    await expect(button).toHaveAccessibleName(/\S/);
  }
});

test('menus and dialogs give focus back to what opened them', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/');
  const account = page.getByRole('button', { name: /Account: Rohan S\./ });
  await account.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(account).toBeFocused();

  await page.keyboard.press('ControlOrMeta+k');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await expect(palette.getByRole('combobox')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();
  await expect(account).toBeFocused();
});

test('change a setting with the keyboard; the result is announced', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/settings/profile');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  const toggle = page.getByRole('switch').first();
  await toggle.focus();
  const was = await toggle.getAttribute('aria-checked');
  await page.keyboard.press('Space');
  await expect(toggle).not.toHaveAttribute('aria-checked', was ?? '');
});

test('sign-in takes a pasted password and asks no puzzle', async ({ page }) => {
  await useMockBackend(page, 'signed-out');
  await page.goto('/login');
  const password = page.getByLabel('Password', { exact: true });
  await expect(password).toHaveAttribute('autocomplete', 'current-password');
  await expect(page.getByLabel('Email')).toHaveAttribute('autocomplete', /username|email/);
  const blocked = await password.evaluate((input) => {
    const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
    return !input.dispatchEvent(event);
  });
  expect(blocked, 'pasting into the password is blocked').toBe(false);
  await expect(page.locator('iframe, [class*="captcha" i]')).toHaveCount(0);
});

test('with reduced motion, nothing animates', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await useMockBackend(page, 'ready');
  await page.goto('/work/board/PLT');
  await expect(page).toHaveTitle(/^Board · /);
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
  const moving = await page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter((el) => {
        const style = getComputedStyle(el);
        const seconds = (value: string) => Math.max(...value.split(',').map((v) => parseFloat(v)));
        return seconds(style.animationDuration) > 0.01 || seconds(style.transitionDuration) > 0.01;
      })
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`),
  );
  expect(moving).toEqual([]);
  await context.close();
});

/** 2.4.11: no focused control is hidden under the sticky header, a toast or the bottom bar. */
for (const [width, path] of [
  [1440, '/work/backlog/PLT'],
  [1440, '/settings/profile'],
  [390, '/work/backlog/PLT'],
  [390, '/settings/notifications'],
] as const) {
  test(`focus is never obscured at ${width}px on ${path}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, viewport: { width, height: 700 } });
    const page = await context.newPage();
    await useMockBackend(page, 'ready');
    await page.goto(path);
    await expect(page.getByRole('main')).toBeVisible();
    await page.waitForTimeout(500);
    const hidden: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('Tab');
      const covered = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return null;
        const points = [
          [box.left + box.width / 2, box.top + box.height / 2],
          [box.left + 2, box.top + 2],
          [box.right - 2, box.bottom - 2],
        ];
        const visible = points.some(([x, y]) => {
          const hit = document.elementFromPoint(x ?? 0, y ?? 0);
          return hit !== null && (el.contains(hit) || hit.contains(el));
        });
        return visible
          ? null
          : (el.getAttribute('aria-label') ?? el.textContent?.slice(0, 40) ?? el.tagName);
      });
      if (covered) hidden.push(covered);
    }
    expect(hidden).toEqual([]);
    await context.close();
  });
}
