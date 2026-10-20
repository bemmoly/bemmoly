import type { CodeEventOf, CodeHostClient, CodeHostDirectory, RequestContext } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { createPipelinesServices, type PipelinesServices } from '../index.ts';

const FILE = 'services/ledger/.bemmoly/application.yaml';

function push(deliveryId: string, files: string[], branch = 'main'): CodeEventOf {
  return {
    type: 'push',
    repository: 'acme/checkout',
    occurredAt: '2026-10-17T05:30:00Z',
    integrationId: '00000000-0000-4000-8000-000000000001',
    hostKind: 'github',
    deliveryId,
    push: {
      branch,
      before: '0'.repeat(40),
      after: 'a'.repeat(40),
      defaultBranch: 'main',
      isDefaultBranch: branch === 'main',
      created: false,
      deleted: false,
      forced: false,
      changedFiles: files,
      truncated: false,
      commits: 1,
      pusher: 'priya',
    },
  };
}

/** A connected host whose repository holds one application.yaml. */
const directory: CodeHostDirectory = {
  async clientFor() {
    const client: Partial<CodeHostClient> = {
      integrationId: 'integration-1',
      hostKind: 'github',
      readFile: async (_repo, path) =>
        path === FILE ? 'name: ledger\ngroup: checkout\nowner: team/payments\ntier: 1\n' : null,
      listFiles: async () => ({ paths: [FILE], truncated: false }),
    };
    return client as CodeHostClient;
  },
  repositories: async () => [],
};

describe('the webhook inbox', () => {
  let harness: PipelinesHarness | undefined;
  let services: PipelinesServices;
  let system: RequestContext;
  let reason = '';
  const queued: string[] = [];

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    await seedCatalogFixture(harness.sql, harness.users.member);
    services = createPipelinesServices({
      database: harness.sql,
      codeHosts: directory,
      sendJob: async (_name, payload) => {
        queued.push(String(payload.repository));
      },
    });
    system = {
      ...harness.as(harness.users.admin),
      actor: { kind: 'system', id: 'pipelines.inbox' },
    };
  });

  afterAll(async () => harness?.stop());

  it('stores each delivery once and asks for a drain of its repository', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const first = await services.inbox.ingest([push('d-1', ['README.md'], 'feature')]);
    const again = await services.inbox.ingest([push('d-1', ['README.md'], 'feature')]);
    expect(first.notes).toEqual(['1 queued for Pipelines']);
    expect(again.notes).toEqual([]);
    expect(queued).toEqual(['acme/checkout']);
  });

  it('processes a repository in arrival order and holds it at a failing event', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const seen: string[] = [];
    let failOnce = true;
    services.inbox.on('push', async (event) => {
      if (event.deliveryId === 'd-3' && failOnce) {
        failOnce = false;
        throw new Error('the runner pool is unreachable');
      }
      seen.push(event.deliveryId);
    });
    await services.inbox.ingest([push('d-2', ['a.ts'], 'feature')]);
    await services.inbox.ingest([push('d-3', ['b.ts'], 'feature')]);
    await services.inbox.ingest([push('d-4', ['c.ts'], 'feature')]);
    const held = await services.inbox.drain('acme/checkout', system);
    expect(held).toMatchObject({ status: 'held', error: 'the runner pool is unreachable' });
    expect(seen).toEqual(['d-1', 'd-2']);
    const drained = await services.inbox.drain('acme/checkout', system);
    expect(drained).toMatchObject({ status: 'drained', processed: 2 });
    expect(seen).toEqual(['d-1', 'd-2', 'd-3', 'd-4']);
  });

  it('syncs application.yaml from a push to the default branch', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    await services.inbox.ingest([push('d-5', [FILE, 'services/ledger/src/index.ts'])]);
    await services.inbox.drain('acme/checkout', system);
    const [app] = await harness.sql<{ key: string; tier: number; owner: string | null }[]>`
      select a.key, a.tier, t.name as owner from pipeline_applications a
        left join teams t on t.id = a.owner_team_id where a.key = 'ledger'`;
    expect(app).toEqual({ key: 'ledger', tier: 1, owner: 'Payments' });
    const [row] = await harness.sql<{ state: string }[]>`
      select state from pipeline_webhook_inbox where delivery_id = 'd-5:0'`;
    expect(row?.state).toBe('done');
  });
});
