import { expect, type Page } from '@playwright/test';
import type { MockScenario } from '../../src/mocks/db.ts';
import { INVITE_TOKEN, RESET_TOKEN } from '../../src/mocks/db.ts';
import { NO_COLLAB_SERVER } from '../../src/mocks/msw.ts';
import { RFC_PAGE_ID } from '../../src/mocks/seed/ai-insights.ts';
import { uid } from '../../src/mocks/seed/time.ts';

/**
 * One screen of the product for the accessibility audit: where it lives, who opens it, and
 * what the page must show before axe looks (so a skeleton is never what gets checked). `open`
 * runs after `ready` for a state reached by interaction: a dialog, a margin, the palette.
 */
export interface Screen {
  name: string;
  path: string;
  scenario?: MockScenario;
  ready?: (page: Page) => Promise<unknown>;
  open?: (page: Page) => Promise<unknown>;
}

const heading =
  (name: string | RegExp, level = 1) =>
  (page: Page) =>
    expect(page.getByRole('heading', { name, level }).first()).toBeVisible();
const title = (pattern: RegExp) => (page: Page) => expect(page).toHaveTitle(pattern);

/** The page editor has no collaboration server behind the mock; it edits locally, as in dev. */
export async function closeCollab(page: Page): Promise<void> {
  await page.routeWebSocket(/\/collab$/, (socket) => {
    void socket.close({ code: NO_COLLAB_SERVER, reason: 'No collaboration server' });
  });
}

const editorReady = (page: Page) =>
  expect(
    page.locator('[contenteditable="true"]').filter({ hasText: 'moving session' }),
  ).toBeVisible();

const margin = (name: string) => async (page: Page) => {
  await page
    .getByRole('button', { name: new RegExp(`^${name}`) })
    .first()
    .click();
  // A margin on wide screens, a sheet on a phone.
  const panel = page.getByRole('complementary', { name }).or(page.getByRole('dialog', { name }));
  await expect(panel.first()).toBeVisible();
};

export const SIGNED_OUT: readonly Screen[] = [
  { name: 'sign in', path: '/login', scenario: 'signed-out', ready: heading(/^Sign in/) },
  {
    name: 'sign in, session ended',
    path: '/login?reason=expired',
    scenario: 'signed-out',
    ready: heading('Sign in again'),
  },
  {
    name: 'sign in with single sign-on',
    path: '/login?sso=3',
    scenario: 'signed-out',
    ready: heading(/^Sign in/),
  },
  {
    name: 'forgot password',
    path: '/forgot-password',
    scenario: 'signed-out',
    ready: (page) => expect(page.getByLabel('Email')).toBeVisible(),
  },
  {
    name: 'reset password',
    path: `/reset-password?token=${RESET_TOKEN}`,
    scenario: 'signed-out',
    ready: (page) => expect(page.getByRole('heading', { level: 1 })).toBeVisible(),
  },
  {
    name: 'accept invitation',
    path: `/accept-invitation?token=${INVITE_TOKEN}`,
    scenario: 'signed-out',
    ready: (page) => expect(page.getByRole('heading', { level: 1 })).toBeVisible(),
  },
  ...[1, 2, 3, 4, 5, 6, 7].map((step): Screen => ({
    name: `setup step ${step}`,
    path: step === 1 ? '/setup' : `/setup?step=${step}`,
    scenario: step <= 2 ? 'fresh' : 'wizard',
    ready: (page) => expect(page.getByRole('heading', { level: 1 })).toBeVisible(),
  })),
];

export const PRODUCT: readonly Screen[] = [
  { name: 'Home', path: '/', ready: heading(/, Rohan$/) },
  { name: 'Inbox', path: '/inbox', ready: title(/^Inbox · /) },
  { name: 'My issues', path: '/work/my-issues', ready: title(/^My issues · /) },
  {
    name: '⌘K',
    path: '/work/board/PLT',
    ready: title(/^Board · /),
    open: async (page) => {
      await page.keyboard.press('ControlOrMeta+k');
      await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
    },
  },
];

export const WORK: readonly Screen[] = [
  { name: 'Board', path: '/work/board/PLT', ready: title(/^Board · Platform Core/) },
  {
    name: 'issue slide-over',
    path: '/work/board/PLT?issue=PLT-204',
    ready: heading('Session store migration to Postgres', 2),
  },
  { name: 'Backlog', path: '/work/backlog/PLT', ready: title(/^Backlog · Platform Core/) },
  { name: 'Roadmap', path: '/work/roadmap/PLT', ready: title(/^Roadmap · /) },
  { name: 'Issue page', path: '/work/issue/PLT-204', ready: title(/^PLT-204 · /) },
  {
    name: 'create issue',
    path: '/work/board/PLT',
    ready: title(/^Board · /),
    open: async (page) => {
      await page.keyboard.press('c');
      await expect(page.getByRole('dialog').first()).toBeVisible();
    },
  },
  { name: 'projects', path: '/work/projects', ready: title(/^Projects · /) },
  ...['board', 'issue-types', 'fields', 'development', 'automation'].map((tab): Screen => ({
    name: `project settings ${tab}`,
    path: `/work/settings/PLT/${tab}`,
    ready: title(/ · Platform Core/),
  })),
  { name: 'project members', path: '/work/members/PLT', ready: title(/ · Platform Core/) },
  { name: 'workflows', path: '/work/workflows/PLT', ready: title(/ · /) },
];

export const DOCS: readonly Screen[] = [
  { name: 'Docs home', path: '/docs', ready: title(/^Docs · /) },
  { name: 'space', path: '/docs/s/ENG', ready: title(/^Engineering · /) },
  { name: 'page editor', path: `/docs/p/${RFC_PAGE_ID}`, ready: editorReady },
  {
    name: 'comments',
    path: `/docs/p/${RFC_PAGE_ID}`,
    ready: editorReady,
    open: margin('Comments'),
  },
  {
    name: 'history',
    path: `/docs/p/${RFC_PAGE_ID}`,
    ready: editorReady,
    open: async (page) => {
      // On a phone, history moves into the page's ··· menu.
      const button = page.getByRole('button', { name: 'Version history' });
      if (await button.isVisible()) await button.click();
      else {
        await page.getByRole('button', { name: 'More actions' }).click();
        await page.getByRole('menuitem', { name: /Version history/ }).click();
      }
      await expect(page.getByRole('heading', { name: 'Version history', level: 1 })).toBeVisible();
    },
  },
];

const SETTINGS_PATHS = [
  'profile',
  'access-tokens',
  'notifications',
  'workspace',
  'appearance',
  'appearance/themes/new',
  'email',
  'ai',
  'ai/privacy',
  'ai/usage',
  'ai/prompts',
  'mcp',
  'webhooks',
  `webhooks/${uid(0xa00)}`,
  'users',
  'teams',
  'roles',
  'authentication',
  'modules',
  'import',
  'code-hosts',
  'backups',
  'updates',
  'system',
  'audit-log',
  'work/issue-types',
  'work/fields',
  'work/workflow',
  'work/board',
];

export const SETTINGS: readonly Screen[] = SETTINGS_PATHS.map((path) => ({
  name: `Settings ${path}`,
  path: `/settings/${path}`,
  ready: (page: Page) => expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible(),
}));

export const ALL_SCREENS = [...SIGNED_OUT, ...PRODUCT, ...WORK, ...DOCS, ...SETTINGS];
