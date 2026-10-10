import { expect, test, type Page } from '@playwright/test';
import { NO_COLLAB_SERVER } from '../src/mocks/msw.ts';
import { aiOf } from '../src/mocks/routes/ai-state.ts';
import { RFC_PAGE_ID } from '../src/mocks/seed/ai-insights.ts';
import { lilacOn } from './support/lilac.ts';
import { useMockBackend, type MockBackend } from './support/mock-backend.ts';

/*
 * The AI-off promise (docs/design/system/ai.md): with AI off for the workspace, or for a person
 * who turned it off for themselves, no screen draws an AI surface, a stored summary or brief
 * stays unshown, and not one element is painted with an `ai` token, in light or dark.
 */

const SCREENS: readonly { path: string; title: RegExp }[] = [
  { path: '/', title: /^Home · / },
  { path: '/inbox', title: /^Inbox · / },
  { path: '/work/my-issues', title: /^My issues · / },
  { path: '/work/board/PLT', title: /^Board · Platform Core/ },
  { path: '/work/board/PLT?issue=PLT-204', title: /^Board · Platform Core/ },
  { path: '/work/backlog/PLT', title: /^Backlog · Platform Core/ },
  { path: '/work/issue/PLT-204', title: /^PLT-204 · / },
  { path: '/work/settings/PLT/board', title: / · Platform Core/ },
  { path: '/work/settings/PLT/fields', title: /^Fields · Platform Core/ },
  { path: '/docs', title: /^Docs · / },
  { path: '/docs/s/ENG', title: /^Engineering · / },
  { path: `/docs/p/${RFC_PAGE_ID}`, title: /Bemmoly$/ },
  { path: '/settings/profile', title: /^Profile · Settings/ },
];

/** Words only an AI surface uses; none may be on screen. */
const AI_WORDS = /by AI|Ask AI|Ask your docs|Summary by AI|Suggest a fix|Not useful|morning brief/i;

async function expectNoLilac(page: Page, where: string) {
  const hits = await lilacOn(page);
  expect(hits, `${where} draws with an AI token`).toEqual([]);
}

async function expectNoAiWords(page: Page, where: string) {
  const text = await page.locator('body').innerText();
  expect(text.match(AI_WORDS)?.[0] ?? null, `${where} names an AI surface`).toBeNull();
}

async function walkScreens(page: Page, mode: 'light' | 'dark') {
  for (const { path, title } of SCREENS) {
    await page.goto(path);
    await expect(page).toHaveTitle(title, { timeout: 10_000 });
    await expect(page.locator('html')).toHaveAttribute('data-mode', mode);
    // An AI card would land with the screen's own queries; give them time to.
    await page.waitForTimeout(600);
    await expectNoLilac(page, path);
    await expectNoAiWords(page, path);
  }
}

/** The page editor: the / menu, the selection bubble and the comments panel. */
async function walkEditor(page: Page) {
  // No collaboration server behind the mock: the page edits locally, as in the dev mock.
  await page.routeWebSocket(/\/collab$/, (socket) => {
    void socket.close({ code: NO_COLLAB_SERVER, reason: 'No collaboration server' });
  });
  await page.goto(`/docs/p/${RFC_PAGE_ID}`);
  // The page reads before its editor loads; the menus need the editor.
  const editor = page.locator('[contenteditable="true"]').filter({ hasText: 'moving session' });
  const heading = editor.getByRole('heading', { name: 'Context' });
  await heading.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/');
  const menu = page.getByRole('listbox', { name: 'Blocks' });
  await expect(menu.getByRole('group', { name: 'Basic blocks' })).toBeVisible();
  await expect(menu.getByRole('group', { name: 'AI' })).toHaveCount(0);
  await expectNoLilac(page, 'the / menu');
  await page.keyboard.type('ai');
  await expect(page.getByText(/No block called/)).toBeVisible();
  await page.keyboard.press('Escape');

  await heading.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+Home');
  const bubble = page.getByRole('toolbar');
  await expect(bubble.getByRole('button', { name: 'Comment' })).toBeVisible();
  await expect(bubble.getByRole('button', { name: /Ask AI/ })).toHaveCount(0);
  await expectNoLilac(page, 'the selection bubble');

  await page.getByRole('button', { name: 'Comments', exact: true }).click();
  const comments = page.getByRole('complementary', { name: 'Comments' });
  await expect(comments.getByText('Looks good overall')).toBeVisible();
  await expect(comments.getByRole('button', { name: /Suggest a fix/ })).toHaveCount(0);
  await expectNoLilac(page, 'the comments panel');
}

/** ⌘K: a sentence finds nothing, and no AI line offers to plan or answer it. */
async function walkPalette(page: Page) {
  await page.goto('/work/board/PLT');
  await expect(page).toHaveTitle(/^Board · /);
  await page.keyboard.press('ControlOrMeta+k');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await palette.getByRole('combobox').fill('move everything blocked by PLT-204 to next sprint');
  await expect(palette.getByText(/Nothing matches/)).toBeVisible();
  await expect(palette.getByRole('option', { name: /Plan with|Ask/ })).toHaveCount(0);
  await expectNoLilac(page, 'the palette');
}

function aiOff(backend: MockBackend) {
  aiOf(backend.api.db).settings.privacy.enabled = false;
}

function optedOut(backend: MockBackend) {
  const me = backend.api.db.signedInAs;
  if (me) aiOf(backend.api.db).optedOut.push(me);
}

const PEOPLE = [
  { who: 'an admin, AI off for the workspace', scenario: 'ready', turnOff: aiOff },
  { who: 'a member who turned AI off, AI on', scenario: 'member', turnOff: optedOut },
] as const;

for (const { who, scenario, turnOff } of PEOPLE) {
  for (const mode of ['light', 'dark'] as const) {
    test.describe(`${who}, ${mode}`, () => {
      test.beforeEach(async ({ page }) => {
        // This device's own choice of mode, as the theme store keeps it.
        await page.addInitScript((chosen) => {
          const theme = { state: { mode: chosen, preset: null }, version: 2 };
          localStorage.setItem('bemmoly.theme', JSON.stringify(theme));
        }, mode);
        turnOff(await useMockBackend(page, scenario));
      });

      test('no screen draws AI or lilac', async ({ page }) => {
        test.setTimeout(90_000);
        await walkScreens(page, mode);
      });

      test('the editor and the palette offer no AI', async ({ page }) => {
        await walkEditor(page);
        await walkPalette(page);
      });
    });
  }
}

test('with AI on, the same check finds the lilac it is looking for', async ({ page }) => {
  await useMockBackend(page, 'ready');
  await page.goto('/');
  await expect(page.getByText(/by AI · built from/)).toBeVisible({ timeout: 10_000 });
  expect((await lilacOn(page)).length).toBeGreaterThan(0);
});

test('a member with AI off for the workspace is not told where to turn it on', async ({ page }) => {
  aiOff(await useMockBackend(page, 'member'));
  for (const path of ['/', '/settings/profile']) {
    await page.goto(path);
    await expect(page.getByRole('main')).toBeVisible();
    await page.waitForTimeout(600);
    await expect(page.getByText(/\bAI\b/)).toHaveCount(0);
  }
});
