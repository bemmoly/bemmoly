import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { useMockBackend } from './support/mock-backend.ts';

/*
 * The shell in the pseudo-locale (en-XA, ADR 0025): every extracted word is accented, about 40%
 * longer and bracketed. Text that stayed English was never extracted; text that spills out of
 * its box or is cut off without an ellipsis breaks when a real language runs longer. Each
 * screen is attached as a screenshot to the report for a person to look over too.
 */

interface Overflow {
  element: string;
  text: string;
  overflow: number;
}

/** Text boxes whose content is wider than they are, unless they scroll or end in an ellipsis. */
async function overflowing(page: Page, roots: string): Promise<Overflow[]> {
  return page.evaluate((selector) => {
    const found: Overflow[] = [];
    for (const root of document.querySelectorAll(selector)) {
      for (const element of [root, ...root.querySelectorAll('*')]) {
        if (!(element instanceof HTMLElement) || element.offsetParent === null) continue;
        const ownText = [...element.childNodes].some(
          (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
        );
        if (!ownText) continue;
        const style = getComputedStyle(element);
        if (['auto', 'scroll'].includes(style.overflowX)) continue;
        // Visually hidden text for screen readers (sr-only) is a 1px box by design.
        if (style.position === 'absolute' && element.clientWidth <= 1) continue;
        if (style.textOverflow === 'ellipsis') continue;
        const overflow = element.scrollWidth - element.clientWidth;
        if (overflow > 1) {
          found.push({
            element: `${element.tagName.toLowerCase()}.${element.className}`.slice(0, 80),
            text: element.textContent?.trim().slice(0, 60) ?? '',
            overflow,
          });
        }
      }
    }
    return found;
  }, roots);
}

async function snapshot(page: Page, info: TestInfo, name: string) {
  await info.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

const pageScrolls = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

test.describe('in the pseudo-locale', () => {
  test('the sidebar and the page header read from their catalogs and nothing overflows', async ({
    page,
  }, info) => {
    await useMockBackend(page, 'ready');
    await page.goto('/?locale=en-XA');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-XA');
    const sidebar = page.getByRole('complementary', { name: /^\[Šíðéƀáŕ ·+\]$/ });
    await expect(sidebar.getByRole('link', { name: /Ĥöɱé/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(sidebar.getByRole('link', { name: /Îñƀöẋ/ })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /Šéáŕçĥ/ })).toBeVisible();
    await expect(page.getByRole('navigation', { name: /Ɓŕéáðçŕüɱƀ/ })).toBeVisible();
    // The language survives a reload: ?locale= is this device's choice now.
    await page.goto('/inbox');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-XA');
    await snapshot(page, info, 'shell, desktop');
    expect(await overflowing(page, 'aside, header, [data-sidebar] nav')).toEqual([]);
    expect(await pageScrolls(page)).toBe(false);

    await sidebar.getByRole('button', { name: /Åççöüñţ/ }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: /Šíĝñ öüţ/ })).toBeVisible();
    await snapshot(page, info, 'account menu');
    expect(await overflowing(page, '[role="menu"]')).toEqual([]);
  });

  test('the folded rail and Profile hold the longer words', async ({ page }, info) => {
    await useMockBackend(page, 'ready');
    await page.goto('/settings/profile?locale=en-XA');
    await expect(page.getByRole('heading', { name: /Þŕöƒíļé/ })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Ļáñĝüáĝé/ })).toBeVisible();
    await snapshot(page, info, 'profile');
    expect(await overflowing(page, 'main')).toEqual([]);
    await page.goto('/?locale=en-XA');
    await expect(page.locator('[data-sidebar="full"]')).toBeVisible();
    await page.keyboard.press('[');
    await expect(page.locator('[data-sidebar="rail"]')).toBeVisible();
    await snapshot(page, info, 'rail');
    expect(await overflowing(page, 'aside')).toEqual([]);
  });

  test('sign-in, before anyone is known, follows the device', async ({ page }, info) => {
    await useMockBackend(page, 'signed-out');
    await page.goto('/login?locale=en-XA');
    await expect(
      page.getByRole('heading', { level: 1, name: /Šíĝñ íñ ţö Acme Labs/ }),
    ).toBeVisible();
    await expect(page.getByLabel(/Éɱáíļ/)).toBeVisible();
    await page.getByLabel(/Éɱáíļ/).fill('rohan@acmelabs.dev');
    await page
      .getByLabel(/Þáššŵöŕð/, { exact: false })
      .first()
      .fill('not the password');
    await page.getByRole('button', { name: /^\[Šíĝñ íñ/ }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await snapshot(page, info, 'sign-in, failed');
    expect(await overflowing(page, 'main, header, footer')).toEqual([]);
    expect(await pageScrolls(page)).toBe(false);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('the bottom bar, header and sign-in fit', async ({ page }, info) => {
      await useMockBackend(page, 'ready');
      await page.goto('/?locale=en-XA');
      const bar = page.getByRole('navigation', { name: /Ǫüíçķ ñáṽíĝáţíöñ/ });
      await expect(bar).toBeVisible();
      await snapshot(page, info, 'phone, home');
      expect(await overflowing(page, 'header')).toEqual([]);
      expect(await pageScrolls(page)).toBe(false);
      await page.getByRole('button', { name: /Öþéñ ɱéñü/ }).click();
      await expect(page.getByRole('dialog', { name: /Ṁéñü/ })).toBeVisible();
      await snapshot(page, info, 'phone, sheet');
      expect(await overflowing(page, 'dialog')).toEqual([]);

      await useMockBackend(page, 'signed-out');
      await page.goto('/login');
      await expect(page.getByRole('heading', { level: 1, name: /Šíĝñ íñ/ })).toBeVisible();
      await snapshot(page, info, 'phone, sign-in');
      expect(await overflowing(page, 'main, header, footer')).toEqual([]);
      expect(await pageScrolls(page)).toBe(false);
    });
  });
});
