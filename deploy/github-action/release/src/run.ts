import {
  buildReleaseBody,
  createHttp,
  createPipelinesClient,
  githubOidcToken,
  platformDigests,
} from '@bemmoly/pipelines-cli/ci';
import type { ActionEnv } from './config/env.ts';

/*
 * One step at the end of a company's own workflow: the image it built becomes a Pipelines
 * release. Signed with the workflow's OIDC token unless a CI token is given, so no secret is
 * stored; Pipelines maps the token's repository and ref to the application by trust rule.
 */

export interface ActionIo {
  fetch?: typeof fetch;
  /** Expands the tests input (paths or globs) to files under the workspace. */
  findReports(patterns: readonly string[]): Promise<string[]>;
  readFile(path: string): Promise<string>;
  info(line: string): void;
  setOutput(name: string, value: string): Promise<void>;
  summary(markdown: string): Promise<void>;
}

export const OIDC_MISSING =
  'No token: give the job "permissions: id-token: write" so the action can sign with the workflow\'s OIDC token, or pass a CI token in the token input.';

async function tokenFor(env: ActionEnv, server: string, io: ActionIo): Promise<string> {
  if (env.INPUT_TOKEN) return env.INPUT_TOKEN;
  if (!env.ACTIONS_ID_TOKEN_REQUEST_URL || !env.ACTIONS_ID_TOKEN_REQUEST_TOKEN) {
    throw new Error(OIDC_MISSING);
  }
  return githubOidcToken({
    requestUrl: env.ACTIONS_ID_TOKEN_REQUEST_URL,
    requestToken: env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
    audience: server,
    ...(io.fetch ? { fetch: io.fetch } : {}),
  });
}

export async function runAction(env: ActionEnv, io: ActionIo) {
  const server = env.INPUT_SERVER.replace(/\/+$/, '');
  const reports = await io.findReports(env.INPUT_TESTS);
  if (env.INPUT_TESTS.length > 0 && reports.length === 0) {
    io.info(`No JUnit reports matched ${env.INPUT_TESTS.join(', ')}; registering without tests.`);
  }
  const runUrl =
    env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID
      ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
      : undefined;
  const body = buildReleaseBody({
    application: env.INPUT_APPLICATION,
    commitSha: env.GITHUB_SHA,
    version: env.INPUT_VERSION,
    ref: env.GITHUB_REF,
    imageRepository: env['INPUT_IMAGE-REPOSITORY'],
    image: env.INPUT_IMAGE,
    images: env.INPUT_IMAGES.length > 0 ? platformDigests(env.INPUT_IMAGES) : undefined,
    junit: await Promise.all(reports.map((path) => io.readFile(path))),
    externalUrl: runUrl,
    notes: env.INPUT_NOTES,
  });
  const token = await tokenFor(env, server, io);
  const client = createPipelinesClient(
    createHttp({ baseUrl: server, token, ...(io.fetch ? { fetch: io.fetch } : {}) }),
  );
  const release = await client.registerRelease(body);
  io.info(`Registered ${release.application.key} ${release.version} (${release.id}).`);
  await io.setOutput('release-id', release.id);
  await io.setOutput('version', release.version);
  const tests = release.testSummary
    ? ` · tests ${release.testSummary.passed} passed, ${release.testSummary.failed} failed`
    : '';
  await io.summary(
    `### Bemmoly release\n\n${release.application.key} **${release.version}** registered${tests}.\n`,
  );
  return release;
}
