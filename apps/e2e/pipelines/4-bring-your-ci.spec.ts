import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import { expectLoaded, openPipelines } from '../support/pipelines.ts';
import { readState, REPO_ROOT } from '../support/state.ts';

const run = promisify(execFile);

/*
 * Walkthrough step 4, Bring your CI: a scoped CI token from Platform, then `bp release
 * create` the way another CI system would call it. The release shows in Releases, built
 * elsewhere, and opens in Promote.
 */

test('bp release create with a CI token registers a release that can be promoted', async ({
  browser,
}) => {
  const state = readState();
  const page = await openPipelines(browser, '/releases');
  const created = await page.request.post('/api/v1/pipelines/ci/tokens', {
    data: { name: 'Walkthrough CI', applications: ['checkout-api'] },
    headers: { origin: state.baseURL },
  });
  expect(created.status()).toBe(201);
  const { token } = (await created.json()) as { token: string };

  const version = `9.${Date.now() % 100_000}.0`;
  const { stdout } = await run(
    process.execPath,
    [
      'apps/pipelines-cli/src/bin.ts',
      'release',
      'create',
      '--server',
      state.baseURL,
      '--token',
      token,
      '--application',
      'checkout-api',
      '--commit',
      'a1c9e3f0'.repeat(5),
      '--image-repository',
      'ghcr.io/acme/checkout-api',
      '--image',
      `sha256:${'b'.repeat(64)}`,
      '--version',
      version,
    ],
    // --server and --token win over any stored sign-in of the machine running the suite.
    { cwd: REPO_ROOT },
  );
  expect(stdout).toContain(`Registered checkout-api ${version}`);
  const releaseId = /Release id: (\S+)/.exec(stdout)?.[1];
  expect(releaseId).toBeTruthy();

  // The token is scoped: another application is refused.
  const refused = await run(
    process.execPath,
    [
      'apps/pipelines-cli/src/bin.ts',
      'release',
      'create',
      '--server',
      state.baseURL,
      '--token',
      token,
      '--application',
      'payments-worker',
      '--commit',
      'a1c9e3f0'.repeat(5),
      '--image',
      `sha256:${'c'.repeat(64)}`,
    ],
    { cwd: REPO_ROOT },
  ).then(
    () => null,
    (error: { code?: number }) => error,
  );
  expect(refused?.code).toBeGreaterThan(0);

  await page.goto(`/pipelines/releases/${releaseId}/promote`);
  await expect(page.getByText(`v${version}`).or(page.getByText(version)).first()).toBeVisible();
  await expectLoaded(page);
});
