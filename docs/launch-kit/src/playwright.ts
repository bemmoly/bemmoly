/**
 * The launch kit is not a workspace package, so it borrows the Playwright that @bemmoly/ui
 * already pins (packages/ui/package.json) instead of adding a dependency of its own.
 */
import { createRequire } from 'node:module';
import type * as PlaywrightTest from '@playwright/test';

const require = createRequire(new URL('../../../packages/ui/package.json', import.meta.url));
const playwright = require('@playwright/test') as typeof PlaywrightTest;

export const chromium = playwright.chromium;
