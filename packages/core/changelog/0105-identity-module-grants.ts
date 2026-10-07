import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

export default changeset({
  id: '0105-identity-module-grants',
  author: 'keerthi',
  description: 'Create module_grants: who may see each module',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE module_grants (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        module_id text NOT NULL,
        subject_kind text NOT NULL,
        subject_id uuid,
        granted_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT module_grants_subject_key
          UNIQUE NULLS NOT DISTINCT (module_id, subject_kind, subject_id),
        CONSTRAINT module_grants_subject_check CHECK (
          subject_kind IN ('everyone', 'team', 'role', 'user')
          AND ((subject_kind = 'everyone') = (subject_id IS NULL))
        )
      )`);
    await ctx.exec(sql`
      CREATE INDEX module_grants_subject_idx ON module_grants (subject_kind, subject_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE module_grants`);
  },
});
