import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

/** A fixed port; BEMMOLY_WEB_E2E_PORT moves it for machines that must keep to a range. */
const PORT = Number(process.env['BEMMOLY_WEB_E2E_PORT'] ?? 4318);
const baseURL = `http://127.0.0.1:${PORT}`;

/** The server serves the built shell, as in production; run `pnpm build` first. */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node ../server/src/server.ts',
    url: `${baseURL}/healthz`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: String(PORT),
      BEMMOLY_PUBLIC_URL: baseURL,
      BEMMOLY_SECRET_KEY: randomBytes(32).toString('base64'),
      LOG_LEVEL: 'warn',
    },
  },
});
