import type {
  EventBus,
  JobRegistry,
  RealtimePublisher,
  SettingsRegistry,
  SqlClient,
} from '@bemmoly/core';
import { ProviderError } from '@bemmoly/shared';
import type { SampleItem, SamplePingResponse } from '../../../shared/schemas.ts';

export const SAMPLE_PING_JOB = 'sample.ping';
export const SAMPLE_ITEM_CREATED = 'sample.item.created';

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

const toItem = (row: ItemRow): SampleItem => ({
  id: row.id,
  label: row.label,
  createdAt: new Date(row.created_at).toISOString(),
});

/** Everything the sample module does, through the kernel's registries only. */
export function createItemsService(deps: ItemsServiceDeps) {
  const db = (): SqlClient => {
    if (!deps.database) throw new ProviderError('The sample module needs the database');
    return deps.database;
  };

  async function create(label: string): Promise<SampleItem> {
    const [row] = await db()<ItemRow[]>`
      insert into sample_items (label) values (${label}) returning id, label, created_at`;
    if (!row) throw new ProviderError('The item was not stored');
    const item = toItem(row);
    await deps.realtime.publish({ kind: SAMPLE_ITEM_CREATED, ids: [item.id], moduleId: 'sample' });
    await deps.events.publish({
      kind: SAMPLE_ITEM_CREATED,
      occurredAt: new Date(),
      entity: { kind: 'sample_item', id: item.id },
      payload: { id: item.id },
    });
    return item;
  }

  return {
    async list(): Promise<SampleItem[]> {
      const rows = await db()<ItemRow[]>`
        select id, label, created_at from sample_items order by id desc limit 100`;
      return rows.map(toItem);
    },
    create,
    async ping(idempotencyKey?: string): Promise<SamplePingResponse> {
      const jobId = await deps.jobs.send(
        SAMPLE_PING_JOB,
        {},
        idempotencyKey ? { idempotencyKey } : {},
      );
      return { jobId, deduplicated: jobId === null };
    },
    /** The sample.ping job: stores one item labelled with the greeting setting. */
    async recordPing(): Promise<SampleItem> {
      return create(`ping: ${await deps.settings.get('sample.greeting')}`);
    },
    greeting: () => deps.settings.get('sample.greeting'),
  };
}

export type ItemsService = ReturnType<typeof createItemsService>;
