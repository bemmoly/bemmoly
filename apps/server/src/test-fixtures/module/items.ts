import type {
  EventBus,
  JobRegistry,
  RealtimePublisher,
  SettingsRegistry,
  SqlClient,
} from '@bemmoly/core';
import { ProviderError } from '@bemmoly/shared';

export const FIXTURE_PING_JOB = 'fixture.ping';
export const FIXTURE_ITEM_CREATED = 'fixture.item.created';

export interface FixtureItem {
  id: string;
  label: string;
  createdAt: string;
}

export interface ItemsServiceDeps {
  database?: SqlClient;
  realtime: RealtimePublisher;
  events: EventBus;
  jobs: JobRegistry;
  settings: SettingsRegistry;
}

interface ItemRow {
  id: string;
  label: string;
  created_at: Date | string;
}

const toItem = (row: ItemRow): FixtureItem => ({
  id: row.id,
  label: row.label,
  createdAt: new Date(row.created_at).toISOString(),
});

/** Everything the fixture module does, through the kernel's registries only. */
export function createItemsService(deps: ItemsServiceDeps) {
  const db = (): SqlClient => {
    if (!deps.database) throw new ProviderError('The fixture module needs the database');
    return deps.database;
  };

  async function create(label: string): Promise<FixtureItem> {
    const [row] = await db()<ItemRow[]>`
      insert into fixture_items (label) values (${label}) returning id, label, created_at`;
    if (!row) throw new ProviderError('The item was not stored');
    const item = toItem(row);
    await deps.realtime.publish({
      kind: FIXTURE_ITEM_CREATED,
      ids: [item.id],
      moduleId: 'fixture',
    });
    await deps.events.publish({
      kind: FIXTURE_ITEM_CREATED,
      occurredAt: new Date(),
      entity: { kind: 'fixture_item', id: item.id },
      payload: { id: item.id },
    });
    return item;
  }

  return {
    async list(): Promise<FixtureItem[]> {
      const rows = await db()<ItemRow[]>`
        select id, label, created_at from fixture_items order by id desc limit 100`;
      return rows.map(toItem);
    },
    create,
    async ping(idempotencyKey?: string): Promise<{ jobId: string | null; deduplicated: boolean }> {
      const jobId = await deps.jobs.send(
        FIXTURE_PING_JOB,
        {},
        idempotencyKey ? { idempotencyKey } : {},
      );
      return { jobId, deduplicated: jobId === null };
    },
    /** The fixture.ping job: stores one item labelled with the greeting setting. */
    async recordPing(): Promise<FixtureItem> {
      return create(`ping: ${await deps.settings.get('fixture.greeting')}`);
    },
    greeting: () => deps.settings.get('fixture.greeting'),
  };
}

export type ItemsService = ReturnType<typeof createItemsService>;
