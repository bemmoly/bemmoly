import { describe, expect, it, vi } from 'vitest';
import { githubDelivery, type GithubFixture } from '../../testing/code-host-deliveries.ts';
import { githubManifest } from './hosts/github-app.ts';
import { codeHostDriver } from './registry.ts';
import { dispatchEvents, type CodeHostRuntime } from './runtime.ts';
import type { IntegrationRow } from './store.ts';

const SECRET = 'a-webhook-secret-of-some-length';

const parse = (name: GithubFixture) => {
  const delivery = githubDelivery(name, SECRET);
  return codeHostDriver('github').parse({
    headers: delivery.headers,
    body: Buffer.from(delivery.body),
  });
};

describe('GitHub deliveries as events', () => {
  it('reads a push to the default branch with the files it changed', () => {
    const parsed = parse('push.main');
    expect(parsed.events).toEqual([
      {
        type: 'push',
        repository: 'acme/api',
        occurredAt: expect.any(String),
        push: {
          branch: 'main',
          before: '5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c',
          after: 'e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8',
          defaultBranch: 'main',
          isDefaultBranch: true,
          created: false,
          deleted: false,
          forced: false,
          changedFiles: [
            'services/checkout-api/.bemmoly/application.yaml',
            'src/auth/limits.test.ts',
            'src/auth/limits.ts',
          ],
          truncated: false,
          commits: 2,
          pusher: 'priya-n',
        },
      },
    ]);
    expect(parsed.activities[0]?.push?.isDefaultBranch).toBe(true);
  });

  it('keeps the push detail on the branch activity of a feature branch', () => {
    const parsed = parse('push');
    expect(parsed.activities[0]).toMatchObject({
      kind: 'branch',
      push: { isDefaultBranch: false },
    });
    expect(parsed.activities[1]).not.toHaveProperty('push');
  });

  it('reads a pull request with its head commit and base', () => {
    expect(parse('pull_request.opened').events).toEqual([
      expect.objectContaining({
        type: 'pull_request',
        action: 'opened',
        number: 4821,
        headSha: '9f2c1d7e8b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e',
        headRef: 'feat/acme-1-pg-sessions',
        baseRef: 'main',
        fromFork: false,
      }),
    ]);
  });

  it('reads merge queue groups, check runs and workflow runs', () => {
    expect(parse('merge_group.checks_requested').events?.[0]).toMatchObject({
      type: 'merge_group',
      headSha: 'c3d4e5f60718293a4b5c6d7e8f9012345678a1b2',
      baseRef: 'refs/heads/main',
    });
    expect(parse('check_run.completed').events?.[0]).toMatchObject({
      type: 'check_run',
      name: 'security-scan',
      status: 'completed',
      conclusion: 'success',
      app: 'github-actions',
    });
    expect(parse('workflow_run.completed').events?.[0]).toMatchObject({
      type: 'workflow_run',
      path: '.github/workflows/security.yml',
      conclusion: 'failure',
      runId: '11223344556',
    });
  });

  it('reads repository changes and installation changes', () => {
    expect(parse('repository.renamed').events?.[0]).toMatchObject({
      type: 'repository',
      action: 'renamed',
      previousName: 'api-legacy',
    });
    expect(parse('installation_repositories.added').events?.map((e) => e.repository)).toEqual([
      'acme/checkout',
      'acme/payments',
    ]);
  });
});

describe('event consumers', () => {
  it('stamps each event with the delivery and hands it to every enabled consumer', async () => {
    const apply = vi.fn(async () => ({ linked: 0, notes: ['1 run started'] }));
    const rt = {
      eventConsumers: () => [{ id: 'pipelines.inbox', apply }],
      systemContext: (id: string) => ({ actor: { kind: 'system', id } }),
    } as unknown as CodeHostRuntime;
    const row = { id: 'integration-1', kind: 'github' } as IntegrationRow;
    const events = parse('push.main').events ?? [];
    const notes = await dispatchEvents(rt, row, 'delivery-1', events);
    expect(notes).toEqual(['1 run started']);
    expect(apply).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          type: 'push',
          integrationId: 'integration-1',
          deliveryId: 'delivery-1',
        }),
      ],
      { actor: { kind: 'system', id: 'code-host:integration-1' } },
    );
  });
});

describe('the app manifest', () => {
  it('adds what enabled modules ask for, write winning over read', () => {
    const manifest = JSON.parse(
      githubManifest({
        publicUrl: 'https://bemmoly.acme.dev',
        webhookUrl: 'https://bemmoly.acme.dev/api/v1/code-hosts/1/webhooks',
        redirectUrl: 'https://bemmoly.acme.dev/settings',
        setupUrl: 'https://bemmoly.acme.dev/settings?installed=1',
        extra: [
          {
            permissions: { checks: 'write', deployments: 'write', contents: 'write' },
            events: ['check_run', 'workflow_run', 'merge_group', 'push'],
          },
        ],
      }),
    ) as { default_permissions: Record<string, string>; default_events: string[] };
    expect(manifest.default_permissions).toMatchObject({
      checks: 'write',
      deployments: 'write',
      contents: 'write',
      pull_requests: 'read',
    });
    expect(manifest.default_events.filter((event) => event === 'push')).toHaveLength(1);
    expect(manifest.default_events).toContain('merge_group');
  });
});
