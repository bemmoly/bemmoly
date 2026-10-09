import { changeset, sql } from '@bemmoly/core/changelog';

/** Bytes live in the kernel object store under storage_key; this is the index. */
export default changeset({
  id: '0015-work-attachments',
  author: 'bemmoly',
  description: 'Create attachments',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE attachments (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        target_kind text NOT NULL
          CONSTRAINT attachments_target_kind_check CHECK (target_kind IN ('issue', 'comment')),
        target_id uuid NOT NULL,
        storage_key text NOT NULL,
        filename text NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 255),
        mime text NOT NULL,
        size bigint NOT NULL CHECK (size >= 0),
        sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
        uploaded_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(
      sql`CREATE UNIQUE INDEX attachments_storage_key_key ON attachments (storage_key)`,
    );
    await ctx.exec(sql`
      CREATE INDEX attachments_target_idx ON attachments (target_kind, target_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE attachments`);
  },
});
