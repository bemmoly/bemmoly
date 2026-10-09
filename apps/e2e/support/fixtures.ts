import { test as base, type APIRequestContext, type Page } from '@playwright/test';
import { WorkApi } from './work-api.ts';
import { apiAs } from './seed.ts';
import { readState, type Person, type RunState } from './state.ts';

interface Fixtures {
  run: RunState;
  /** The admin's API, for arranging what a test does not exercise through the screen. */
  admin: WorkApi;
  /** A signed-in page for someone other than the admin. */
  pageAs: (person: Person) => Promise<Page>;
  apiFor: (person: Person) => Promise<WorkApi>;
}

/** Every test runs signed in as the admin against the run's server unless it asks otherwise. */
export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  run: async ({}, use) => use(readState()),
  baseURL: async ({ run }, use) => use(run.baseURL),
  storageState: async ({ run }, use) => use(run.admin.storageState),
  admin: async ({ run }, use) => {
    const context = await apiAs(run.baseURL, run.admin.storageState);
    await use(new WorkApi(context));
    await context.dispose();
  },
  pageAs: async ({ browser, run }, use) => {
    const opened: Awaited<ReturnType<typeof browser.newContext>>[] = [];
    await use(async (person) => {
      const context = await browser.newContext({
        baseURL: run.baseURL,
        storageState: person.storageState,
      });
      opened.push(context);
      return context.newPage();
    });
    for (const context of opened) await context.close();
  },
  apiFor: async ({ run }, use) => {
    const opened: APIRequestContext[] = [];
    await use(async (person) => {
      const context = await apiAs(run.baseURL, person.storageState);
      opened.push(context);
      return new WorkApi(context);
    });
    for (const context of opened) await context.dispose();
  },
});

export { expect } from '@playwright/test';

/** A project key no other test or run uses, e.g. "PA3F". */
export function uniqueKey(prefix: string): string {
  return `${prefix}${Math.random().toString(36).slice(2, 6).toUpperCase().replace(/^\d/, 'X')}`;
}
