import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * Outgoing webhooks (tech design §9): endpoints an admin defines with an event filter and a
 * sealed signing secret, and one row per delivery with its attempts, the receiver's answer
 * and when the next retry is due. The previous minor has no code that reads either table.
 */
export default changeset({
  id: '0701-webhooks',
  author: 'keerthi',
  description: 'Create webhooks and webhook_deliveries',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE webhooks (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
        url text NOT NULL CHECK (char_length(url) <= 2000),
        events text[] NOT NULL DEFAULT '{}',
        format text NOT NULL DEFAULT 'json'
          CONSTRAINT webhooks_format_check
          CHECK (format IN ('json', 'chat_text', 'chat_blocks', 'chat_card')),
        secret_sealed text NOT NULL,
        secret_hint text NOT NULL,
        enabled boolean NOT NULL DEFAULT true,
        disabled_reason text,
        consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
        last_delivery_at timestamptz,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE INDEX webhooks_events_idx ON webhooks USING gin (events)`);
    await ctx.exec(sql`
      CREATE TABLE webhook_deliveries (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        webhook_id uuid NOT NULL REFERENCES webhooks (id) ON DELETE CASCADE,
        event text NOT NULL,
        event_id uuid NOT NULL,
        envelope jsonb NOT NULL,
        status text NOT NULL DEFAULT 'pending'
          CONSTRAINT webhook_deliveries_status_check
          CHECK (status IN ('pending', 'retrying', 'succeeded', 'failed')),
        attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
        max_attempts integer NOT NULL CHECK (max_attempts > 0),
        response_status integer,
        response_excerpt text,
        error text,
        duration_ms integer CHECK (duration_ms >= 0),
        next_attempt_at timestamptz,
        redelivery_of uuid REFERENCES webhook_deliveries (id) ON DELETE SET NULL,
        delivered_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX webhook_deliveries_webhook_idx ON webhook_deliveries (webhook_id, id DESC)`);
    await ctx.exec(sql`
      CREATE INDEX webhook_deliveries_created_idx ON webhook_deliveries (created_at)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE webhook_deliveries`);
    await ctx.exec(sql`DROP TABLE webhooks`);
  },
});
