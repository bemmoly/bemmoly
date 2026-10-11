import { ValidationError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import {
  githubDelivery,
  gitlabDelivery,
  type GithubFixture,
  type GitlabFixture,
} from '../../testing/code-host-deliveries.ts';
import { gitlabTime } from './hosts/gitlab-events.ts';
import { codeHostDriver } from './registry.ts';

const SECRET = 'a-webhook-secret-of-some-length';

const github = (name: GithubFixture) => {
  const delivery = githubDelivery(name, SECRET);
  return codeHostDriver('github').parse({
    headers: delivery.headers,
    body: Buffer.from(delivery.body),
  });
};
const gitlab = (name: GitlabFixture) => {
  const delivery = gitlabDelivery(name, SECRET);
  return codeHostDriver('gitlab').parse({
    headers: delivery.headers,
    body: Buffer.from(delivery.body),
  });
};

describe('GitHub deliveries', () => {
  it('reads an opened pull request with its branch, title and body as key texts', () => {
    const parsed = github('pull_request.opened');
    expect(parsed.summary).toBe('Pull request #4821 opened in acme/api');
    expect(parsed.activities).toEqual([
      {
        repository: 'acme/api',
        kind: 'pull_request',
        externalId: '4821',
        ref: '#4821',
        title: 'Session store to Postgres',
        url: 'https://github.com/acme/api/pull/4821',
        state: 'open',
        checks: null,
        review: null,
        author: 'aisha-k',
        texts: [
          'feat/acme-1-pg-sessions',
          'Session store to Postgres',
          'Moves sessions off Redis.\n\nPart of ACME-1. Rollback plan in the runbook.',
        ],
        occurredAt: '2026-10-01T09:12:44Z',
        mode: 'link',
      },
    ]);
  });

  it('reads a closed pull request that merged as merged', () => {
    const [pull] = github('pull_request.merged').activities;
    expect(pull).toMatchObject({ state: 'merged', occurredAt: '2026-10-03T16:40:02Z' });
  });

  it('reads an approving review onto the pull request', () => {
    const [pull] = github('pull_request_review.submitted').activities;
    expect(pull).toMatchObject({ kind: 'pull_request', review: 'approved', state: 'open' });
  });

  it('reads a push as its branch and each commit, with the message as key text', () => {
    const parsed = github('push');
    expect(parsed.summary).toBe('2 commits pushed to fix/login-throttle in acme/api');
    expect(parsed.activities.map((a) => [a.kind, a.ref, a.title, a.mode])).toEqual([
      ['branch', 'fix/login-throttle', 'fix/login-throttle', 'link'],
      ['commit', 'a1b2c3d', 'Rate limit sign-in per account', 'link'],
      ['commit', 'e7d6c5b', 'Tidy the limiter tests', 'link'],
    ]);
    expect(parsed.activities[1]?.texts[0]).toContain('Fixes ACME-2');
    expect(parsed.activities[0]?.url).toBe('https://github.com/acme/api/tree/fix/login-throttle');
  });

  it('reads branch creation as a link and deletion as a removal', () => {
    expect(github('create.branch').activities[0]).toMatchObject({ kind: 'branch', mode: 'link' });
    expect(github('delete.branch').activities[0]).toMatchObject({
      kind: 'branch',
      externalId: 'feat/acme-1-pg-sessions',
      mode: 'remove',
    });
  });

  it('reads a finished check suite as checks on the pull requests it ran for', () => {
    const parsed = github('check_suite.completed');
    expect(parsed.activities).toEqual([
      expect.objectContaining({ externalId: '4821', checks: 'passing', mode: 'update' }),
    ]);
  });

  it('answers a ping without activities', () => {
    expect(github('ping')).toMatchObject({ event: 'ping', ping: true, activities: [] });
  });

  it('ignores events it does not use', () => {
    const delivery = githubDelivery('push', SECRET);
    const parsed = codeHostDriver('github').parse({
      headers: { ...delivery.headers, 'x-github-event': 'star' },
      body: Buffer.from(delivery.body),
    });
    expect(parsed.activities).toEqual([]);
  });

  it('refuses a body that is not JSON, or not shaped like the event', () => {
    const headers = { 'x-github-event': 'pull_request' };
    const driver = codeHostDriver('github');
    expect(() => driver.parse({ headers, body: Buffer.from('not json') })).toThrow(ValidationError);
    expect(() => driver.parse({ headers, body: Buffer.from('{"action":"opened"}') })).toThrow(
      ValidationError,
    );
  });
});

describe('GitLab deliveries', () => {
  it('reads a draft merge request with GitLab times made ISO', () => {
    const [request] = gitlab('merge_request.open').activities;
    expect(request).toMatchObject({
      repository: 'acme/platform/web',
      kind: 'pull_request',
      externalId: '57',
      ref: '!57',
      state: 'draft',
      url: 'https://gitlab.acme.dev/acme/platform/web/-/merge_requests/57',
      occurredAt: '2026-10-05T10:02:11.000Z',
    });
    expect(request?.texts).toContain('acme-2-export-throttle');
  });

  it('reads a merge as merged and an approval as approved', () => {
    expect(gitlab('merge_request.merge').activities[0]?.state).toBe('merged');
    expect(gitlab('merge_request.approved').activities[0]).toMatchObject({
      state: 'open',
      review: 'approved',
    });
  });

  it('reads a push as its branch and commits', () => {
    const parsed = gitlab('push');
    expect(parsed.activities.map((a) => [a.kind, a.ref])).toEqual([
      ['branch', 'acme-2-export-throttle'],
      ['commit', 'da156088'],
    ]);
  });

  it('reads a failed merge request pipeline as failing checks', () => {
    expect(gitlab('pipeline.failed').activities).toEqual([
      expect.objectContaining({ externalId: '57', checks: 'failing', mode: 'update' }),
    ]);
  });

  it('reads both of GitLab time formats, and falls back on nonsense', () => {
    expect(gitlabTime('2026-10-05 10:02:11 UTC', 'x')).toBe('2026-10-05T10:02:11.000Z');
    expect(gitlabTime('2026-10-06T14:30:00Z', 'x')).toBe('2026-10-06T14:30:00.000Z');
    expect(gitlabTime('soon', 'fallback')).toBe('fallback');
  });
});
