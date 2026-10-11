import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

/*
 * Hand-written webhook deliveries, shaped as GitHub and GitLab send them, for unit,
 * integration and end-to-end tests. Never recorded from a real account. The fixtures name
 * issues ACME-1 and ACME-2; `replace` swaps those for a test's own keys.
 */

const FIXTURES = new URL('./code-hosts/', import.meta.url);

export type GithubFixture =
  | 'pull_request.opened'
  | 'pull_request.merged'
  | 'pull_request_review.submitted'
  | 'push'
  | 'create.branch'
  | 'delete.branch'
  | 'check_suite.completed'
  | 'ping';

export type GitlabFixture =
  | 'merge_request.open'
  | 'merge_request.approved'
  | 'merge_request.merge'
  | 'push'
  | 'pipeline.failed';

const GITLAB_EVENTS: Record<string, string> = {
  merge_request: 'Merge Request Hook',
  push: 'Push Hook',
  pipeline: 'Pipeline Hook',
};

export interface FixtureDelivery {
  headers: Record<string, string>;
  /** The exact bytes the signature covers. */
  body: string;
}

export interface FixtureOptions {
  /** Text swapped in the body before signing, e.g. { 'ACME-1': 'DEV-7' }. */
  replace?: Readonly<Record<string, string>>;
  deliveryId?: string;
}

export function codeHostFixture(
  host: 'github' | 'gitlab',
  name: string,
  replace: Readonly<Record<string, string>> = {},
): string {
  let body = readFileSync(new URL(`${host}/${name}.json`, FIXTURES), 'utf8');
  for (const [from, to] of Object.entries(replace)) {
    body = body.replaceAll(from, to).replaceAll(from.toLowerCase(), to.toLowerCase());
  }
  return body;
}

export const githubSignature = (secret: string, body: string): string =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

/** A GitHub delivery signed with `secret`, as X-Hub-Signature-256 carries it. */
export function githubDelivery(
  name: GithubFixture,
  secret: string,
  options: FixtureOptions = {},
): FixtureDelivery {
  const body = codeHostFixture('github', name, options.replace);
  return {
    body,
    headers: {
      'content-type': 'application/json',
      'user-agent': 'GitHub-Hookshot/7a2c1f0',
      'x-github-event': name.split('.')[0]!,
      'x-github-delivery': options.deliveryId ?? randomUUID(),
      'x-hub-signature-256': githubSignature(secret, body),
    },
  };
}

/** A GitLab delivery carrying the webhook's secret token, as X-Gitlab-Token does. */
export function gitlabDelivery(
  name: GitlabFixture,
  token: string,
  options: FixtureOptions = {},
): FixtureDelivery {
  const body = codeHostFixture('gitlab', name, options.replace);
  return {
    body,
    headers: {
      'content-type': 'application/json',
      'user-agent': 'GitLab/18.4.0',
      'x-gitlab-event': GITLAB_EVENTS[name.split('.')[0]!]!,
      'x-gitlab-event-uuid': options.deliveryId ?? randomUUID(),
      'x-gitlab-token': token,
      'x-gitlab-instance': 'https://gitlab.acme.dev',
    },
  };
}
